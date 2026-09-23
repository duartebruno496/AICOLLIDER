import { useEffect, useState } from "react";
import { FolderTree, MessageSquare, X, Save, Loader2, Sparkles } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { SCRATCH_REPO } from "../types";
import { refreshWorkspace } from "../lib/workspace";
import { detectSyncState, commitAll, createLocalProject } from "../lib/git";
import { listTopLevelDirs, readDir, readFile, writeFile, deletePath } from "../lib/fs";
import { Sidebar } from "./Sidebar";
import { EditorView } from "./EditorView";
import { DiffViewer } from "./DiffViewer";
import { ChatPanel } from "./ChatPanel";
import { TopBar } from "./TopBar";
import { RollbackBar } from "./RollbackBar";
import { SyncModal } from "./SyncModal";
import { StoragePanel } from "./StoragePanel";
import { Modal } from "./common";

async function copyDirRec(src: string, dest: string) {
  const entries = await readDir(src);
  for (const e of entries) {
    if (e.name === ".git") continue;
    const s = `${src}/${e.name}`;
    const d = `${dest}/${e.name}`;
    if (e.kind === "dir") await copyDirRec(s, d);
    else await writeFile(d, await readFile(s));
  }
}

function ScratchSaveBar({ repo }: { repo: string }) {
  const { setActiveRepo, setRepositoryUrl, setTree, setSelectedPath, setContents, setToast } = useAppStore();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function saveProject() {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!slug || slug.startsWith("_")) {
      setErr("Escolha um nome de projeto válido (letras, números, '-' e '.').");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const dirs = await listTopLevelDirs();
      if (dirs.includes(slug)) {
        setErr(`Já existe um projeto chamado "${slug}".`);
        setBusy(false);
        return;
      }
      await createLocalProject(slug);
      await copyDirRec(`/${SCRATCH_REPO}`, `/${slug}`);
      await commitAll(slug, `feat: salva projeto "${slug}" a partir do editor de rascunho`, { name: "AICOLLIDER", email: "aicollider@local" });
      await deletePath(`/${SCRATCH_REPO}`);
      setActiveRepo(slug);
      setRepositoryUrl(null);
      setTree([]);
      setSelectedPath(null);
      setContents("", "");
      setToast(`Projeto "${slug}" salvo. Use o botão git (sincronizar) para subir ao GitHub.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar o projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-amber-200">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <b>Editor sem projeto (rascunho)</b> — seu trabalho fica salvo aqui. Dê um nome para transformar em projeto local:
      </span>
      <input
        className="min-w-0 max-w-48 flex-1 rounded-xl border border-surface-600 bg-surface-900 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-amber-500"
        placeholder="meu-projeto"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !busy && name.trim() && void saveProject()}
        disabled={busy}
      />
      <button
        onClick={() => void saveProject()}
        disabled={busy || !name.trim()}
        className="flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 touch-manipulation"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {busy ? "Salvando..." : "Salvar projeto"}
      </button>
      {err && <span className="text-xs text-rose-300">{err}</span>}
      <span className="ml-auto hidden text-[11px] text-amber-200/70 lg:inline">Você também pode pedir ao <b>modo agente</b> aqui — sem projeto, sem problema.</span>
    </div>
  );
}

export function Workspace({ repo }: { repo: string }) {
  const { pendingChanges, editorMode, showStoragePanel, setShowStoragePanel, setSyncInfo } = useAppStore();
  const [mobileChat, setMobileChat] = useState(false);
  const [mobileFiles, setMobileFiles] = useState(false);

  useEffect(() => {
    void refreshWorkspace(repo);
    void detectSyncState(repo).then((s) => setSyncInfo({ status: s }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const showDiff = pendingChanges.length > 0 || editorMode === "diff";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950">
      <TopBar />
      {repo === SCRATCH_REPO && <ScratchSaveBar repo={repo} />}
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