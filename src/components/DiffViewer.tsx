import { DiffEditor } from "@monaco-editor/react";
import { Check, X, Sparkles } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { languageFromPath } from "../lib/monacoSetup";
import { persistManualChange } from "../lib/commitFile";
import { settlePendingChange } from "../agents/diffGateway";

export function DiffViewer({ repo }: { repo: string }) {
  const { pendingChanges, originalContent, modifiedContent, selectedPath, setEditorMode, setContents, setToast } = useAppStore();
  const current = pendingChanges.length > 0 ? pendingChanges[0] : null;
  const agentMode = current !== null;
  const path = agentMode ? current.path : selectedPath ?? "";
  const original = agentMode ? current.original : originalContent;
  const modified = agentMode ? current.modified : modifiedContent;
  const language = languageFromPath(path);

  async function handleAccept() {
    if (agentMode) {
      settlePendingChange(true);
      return;
    }
    try {
      await persistManualChange(repo, path, modifiedContent);
      setToast(`Commit criado: ${path}`);
      setEditorMode("code");
      setContents(modifiedContent, modifiedContent);
    } catch (e) {
      setToast(`Falha ao salvar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleReject() {
    if (agentMode) {
      settlePendingChange(false);
      return;
    }
    setEditorMode("code");
    setContents(originalContent, originalContent);
    setToast("Alteração descartada.");
  }

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-600 bg-surface-900/70 px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-xs text-slate-300">
          {agentMode && <Sparkles className="h-3.5 w-3.5 text-emerald-400" />}
          {repo}/{path}
          <span className="text-slate-500">
            {agentMode
              ? `· sugestão de ${current.from ?? "IA"} aguardando aprovação${pendingChanges.length > 1 ? ` · ${pendingChanges.length} diffs na fila` : ""}`
              : "· revisão de mudanças"}
          </span>
        </span>
        <span className="mr-16 text-xs text-slate-500">original → modificado</span>
      </div>

      <DiffEditor
        height="100%"
        theme="vs-dark"
        language={language}
        original={original}
        modified={modified}
        options={
          {
            renderSideBySide: true,
            minimap: { enabled: false },
            readOnly: true,
            wordWrap: "on",
            fontSize: 13,
            automaticLayout: true,
            originalEditable: false,
          } as never
        }
      />

      <div className="absolute right-4 top-12 z-10 flex gap-2">
        <button
          onClick={() => void handleAccept()}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition-transform touch-manipulation"
        >
          <Check className="h-4 w-4" /> Aceitar
        </button>
        <button
          onClick={handleReject}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-rose-500 active:scale-95 transition-transform touch-manipulation"
        >
          <X className="h-4 w-4" /> Rejeitar
        </button>
      </div>
    </div>
  );
}