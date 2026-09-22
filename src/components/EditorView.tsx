import Editor from "@monaco-editor/react";
import { FileText, GitCompare } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { languageFromPath } from "../lib/monacoSetup";
import { Button } from "./common";

export function EditorView({ repo }: { repo: string }) {
  const { selectedPath, modifiedContent, setModified, setEditorMode, originalContent, setContents, setToast } = useAppStore();

  if (!selectedPath) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
        <FileText className="h-12 w-12" />
        <p className="text-sm">Abra um arquivo na árvore à esquerda para começar.</p>
      </div>
    );
  }

  const language = languageFromPath(selectedPath);
  const modified = modifiedContent !== originalContent;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-600 bg-surface-900/70 px-3 py-2">
        <span className="truncate font-mono text-xs text-slate-300">📄 {repo}/{selectedPath}</span>
        <div className="flex gap-2">
          {modified && (
            <span className="flex items-center rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-300">alterações não salvas</span>
          )}
          <Button variant="secondary" onClick={() => setEditorMode("diff")} disabled={!modified} className="!min-h-9 !px-3 !py-1.5 !text-xs">
            <GitCompare className="h-3.5 w-3.5" />
            Revisar mudanças
          </Button>
        </div>
      </div>
      <Editor
        height="100%"
        theme="vs-dark"
        language={language}
        value={modifiedContent}
        onChange={(v) => setModified(v ?? "")}
        options={{
          minimap: { enabled: false },
          wordWrap: "on",
          fontSize: 13,
          tabSize: 2,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 12 },
        }}
      />
    </div>
  );
}