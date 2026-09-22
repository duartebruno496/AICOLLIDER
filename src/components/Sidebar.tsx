import { useState } from "react";
import { ChevronRight, FileCode, Folder, FolderOpen } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { readFile } from "../lib/fs";
import type { TreeNode } from "../types";

function Node({ node, depth, repo }: { node: TreeNode; depth: number; repo: string }) {
  const { selectedPath, setSelectedPath, setContents, setEditorMode, pendingChange, setToast } = useAppStore();
  const [open, setOpen] = useState(depth === 0);
  const isDir = node.kind === "dir";

  async function openFile() {
    if (pendingChange) {
      setToast("Aceite ou rejeite a alteração pendente antes de abrir outro arquivo.");
      return;
    }
    try {
      const rel = node.path.replace(new RegExp(`^/${repo}/?`), "");
      const content = await readFile(`/${repo}/${rel}`);
      setContents(content, content);
      setSelectedPath(rel);
      setEditorMode("code");
    } catch (e) {
      setToast(`Não foi possível ler ${node.path}.`);
    }
  }

  return (
    <div>
      <button
        onClick={() => (isDir ? setOpen((o) => !o) : void openFile())}
        className={`flex w-full min-h-9 select-none items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm transition-colors touch-manipulation ${
          !isDir && selectedPath === node.path.replace(new RegExp(`^/${repo}/?`), "")
            ? "bg-sky-600/30 text-sky-200"
            : "text-slate-300 hover:bg-surface-700"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isDir ? (
          <>
            {open ? <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
            {open ? <FolderOpen className="h-4 w-4 text-amber-300" /> : <Folder className="h-4 w-4 text-amber-300" />}
          </>
        ) : (
          <FileCode className="h-4 w-4 text-sky-400" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir &&
        open &&
        node.children?.map((c) => <Node key={c.path} node={c} depth={depth + 1} repo={repo} />)}
    </div>
  );
}

export function Sidebar({ repo }: { repo: string }) {
  const { tree } = useAppStore();
  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-surface-600 bg-surface-900/70 md:flex">
      <div className="sticky top-0 z-10 border-b border-surface-600 bg-surface-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Explorador · {repo}
      </div>
      <div className="flex-1 p-2">
        {tree.length === 0 && <p className="px-2 py-4 text-xs text-slate-500">Carregando árvore de arquivos...</p>}
        {tree.map((n) => (
          <Node key={n.path} node={n} depth={0} repo={repo} />
        ))}
      </div>
    </aside>
  );
}