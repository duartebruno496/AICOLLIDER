import { useEffect, useState } from "react";
import { FolderTree, MessageSquare, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { refreshWorkspace } from "../lib/workspace";
import { detectSyncState } from "../lib/git";
import { Sidebar } from "./Sidebar";
import { EditorView } from "./EditorView";
import { DiffViewer } from "./DiffViewer";
import { ChatPanel } from "./ChatPanel";
import { TopBar } from "./TopBar";
import { RollbackBar } from "./RollbackBar";
import { SyncModal } from "./SyncModal";
import { StoragePanel } from "./StoragePanel";
import { Modal } from "./common";

export function Workspace({ repo }: { repo: string }) {
  const { pendingChange, editorMode, showStoragePanel, setShowStoragePanel, setSyncInfo } = useAppStore();
  const [mobileChat, setMobileChat] = useState(false);
  const [mobileFiles, setMobileFiles] = useState(false);

  useEffect(() => {
    void refreshWorkspace(repo);
    void detectSyncState(repo).then((s) => setSyncInfo({ status: s }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const showDiff = pendingChange !== null || editorMode === "diff";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar repo={repo} />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1">
            {showDiff ? <DiffViewer repo={repo} /> : <EditorView repo={repo} />}

            {/* Touch: drawer de arquivos para tablets/pads */}
            {mobileFiles && (
              <div className="absolute inset-0 z-20 flex bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileFiles(false)}>
                <div className="h-full w-80 max-w-[80%] bg-surface-900" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-surface-600 p-2">
                    <span className="text-xs font-semibold uppercase text-slate-400">Arquivos</span>
                    <button onClick={() => setMobileFiles(false)} className="flex min-h-9 items-center rounded-lg px-2 text-slate-400 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Sidebar repo={repo} />
                </div>
              </div>
            )}

            {/* Touch: chat para telas pequenas */}
            {mobileChat && (
              <div className="absolute inset-0 z-20 flex bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileChat(false)}>
                <div className="ml-auto h-full w-[92%] max-w-md" onClick={(e) => e.stopPropagation()}>
                  <ChatPanel key={repo} repo={repo} />
                </div>
              </div>
            )}
          </div>
          <RollbackBar repo={repo} />
        </main>

        <div className="hidden min-h-0 md:block">
          <ChatPanel key={repo} repo={repo} />
        </div>
      </div>

      {/* Botões flutuantes em touch */}
      <div className="pointer-events-none fixed bottom-20 right-4 z-40 flex flex-col gap-2 md:hidden">
        <button
          onClick={() => setMobileFiles((v) => !v)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-800 text-slate-200 shadow-xl active:scale-95"
          title="Arquivos"
        >
          <FolderTree className="h-5 w-5" />
        </button>
        <button
          onClick={() => setMobileChat((v) => !v)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xl active:scale-95"
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>

      <SyncModal repo={repo} onAfterSync={() => void detectSyncState(repo).then((s) => setSyncInfo({ status: s }))} />

      <Modal open={showStoragePanel} onClose={() => setShowStoragePanel(false)} title="Armazenamento local" wide>
        <StoragePanel />
      </Modal>
    </div>
  );
}