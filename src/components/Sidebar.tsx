import { useState } from "react";
import { ChevronRight, FileCode, FilePlus2, Folder, FolderOpen, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { readFile } from "../lib/fs";
import { createFileEntry, createDirEntry, deleteEntry, renameEntry, toRel } from "../lib/fileOps";
import type { TreeNode } from "../types";

function validName(name: string): string | null {
  const n = name.trim();
  if (!n || n === "." || n === ".." || n.includes("/") || n.includes("\\")) return null;
  return n;
}

function Node({ node, depth, repo }: { node: TreeNode; depth: number; repo: string }) {
  const { selectedPath, setSelectedPath, setContents, setEditorMode, pendingChange, setToast } = useAppStore();
  const [open, setOpen] = useState(depth === 0);
  const [busy, setBusy] = useState(false);
  const isDir = node.kind === "dir";
  const rel = toRel(repo, node.path);
  const selected = !isDir && selectedPath === rel;

  function toast(msg: string) {
    setToast(msg);
  }

  async function openFile() {
    if (pendingChange) {
      toast("Aceite ou rejeite a alteração pendente antes de abrir outro arquivo.");
      return;
    }
    try {
      const content = await readFile(`/${repo}/${rel}`);
      setContents(content, content);
      setSelectedPath(rel);
      setEditorMode("code");
    } catch {
      toast(`Não foi possível ler ${node.path}.`);
    }
  }

  async function openAsFile(relPath: string) {
    try {
      const content = await readFile(`/${repo}/${relPath}`);
      setContents(content, content);
      setSelectedPath(relPath);
      setEditorMode("code");
    } catch {
      setContents("", "");
      setSelectedPath(relPath);
      setEditorMode("code");
    }
  }

  async function newFileHere() {
    if (pendingChange) {
      toast("Aceite ou rejeite a alteração pendente antes.");
      return;
    }
    const raw = window.prompt("Nome do arquivo (na pasta selecionada):");
    if (raw === null) return;
    const name = validName(raw);
    if (!name) {
      toast("Nome inválido.");
      return;
    }
    setBusy(true);
    try {
      const target = isDir ? node.path : node.path.slice(0, node.path.lastIndexOf("/"));
      const created = await createFileEntry(repo, target, name);
      await openAsFile(created);
      toast(`Arquivo ${created} criado.`);
    } catch {
      toast("Falha ao criar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function newFolderHere() {
    const raw = window.prompt("Nome da pasta:");
    if (raw === null) return;
    const name = validName(raw);
    if (!name) {
      toast("Nome inválido.");
      return;
    }
    setBusy(true);
    try {
      const target = isDir ? node.path : node.path.slice(0, node.path.lastIndexOf("/"));
      await createDirEntry(repo, target, name);
      toast(`Pasta ${name} criada.`);
    } catch {
      toast("Falha ao criar a pasta.");
    } finally {
      setBusy(false);
    }
  }

  async function renameHere() {
    const base = rel.split("/").pop() ?? rel;
    const raw = window.prompt("Novo nome:", base);
    if (raw === null) return;
    const next = validName(raw);
    if (!next) {
      toast("Nome inválido.");
      return;
    }
    setBusy(true);
    try {
      const newRel = await renameEntry(repo, node.path, next);
      if (selected) {
        await openAsFile(newRel);
      }
      toast(`Renomeado para ${newRel}.`);
    } catch {
      toast("Falha ao renomear.");
    } finally {
      setBusy(false);
    }
  }

  async function removeHere() {
    if (!window.confirm(`Excluir ${isDir ? "a pasta" : "o arquivo"} "${rel}"?${isDir ? " (recursivo)" : ""}`)) return;
    setBusy(true);
    try {
      await deleteEntry(repo, node.path);
      if (selected) {
        setSelectedPath(null);
        setContents("", "");
      }
      toast(`Excluído: ${rel}.`);
    } catch {
      toast("Falha ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  const actions = (
    <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover:flex">
      {isDir && (
        <button onClick={() => void newFileHere()} title="Novo arquivo aqui" className="rounded p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-100 touch-manipulation">
          <FilePlus2 className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={() => void renameHere()} title="Renomear" className="rounded p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-100 touch-manipulation">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => void removeHere()} title="Excluir" className="rounded p-1 text-slate-500 hover:bg-rose-600/40 hover:text-rose-200 touch-manipulation">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </span>
  );

  return (
    <div className="group">
      <button
        onClick={() => (isDir ? setOpen((o) => !o) : void openFile())}
        disabled={busy}
        className={`flex w-full min-h-9 select-none items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm transition-colors touch-manipulation ${
          selected ? "bg-sky-600/30 text-sky-200" : "text-slate-300 hover:bg-surface-700"
        } ${busy ? "opacity-50" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {isDir ? (
          <>
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-500 ${open ? "rotate-90" : ""}`} />
            {open ? <FolderOpen className="h-4 w-4 shrink-0 text-amber-300" /> : <Folder className="h-4 w-4 shrink-0 text-amber-300" />}
          </>
        ) : (
          <FileCode className="h-4 w-4 shrink-0 text-sky-400" />
        )}
        <span className="min-w-0 truncate">{node.name}</span>
        {actions}
      </button>
      {isDir && open && node.children?.map((c) => <Node key={c.path} node={c} depth={depth + 1} repo={repo} />)}
    </div>
  );
}

export function Sidebar({ repo }: { repo: string }) {
  const { tree, setContents, setSelectedPath, setEditorMode, pendingChange, setToast } = useAppStore();

  async function newFileRoot() {
    if (pendingChange) {
      setToast("Aceite ou rejeite a alteração pendente antes.");
      return;
    }
    const raw = window.prompt("Nome do arquivo (na raiz):");
    if (raw === null) return;
    const name = validName(raw);
    if (!name) {
      setToast("Nome inválido.");
      return;
    }
    try {
      const created = await createFileEntry(repo, "", name);
      let content = "";
      try {
        content = await readFile(`/${repo}/${created}`);
      } catch {
        content = "";
      }
      setContents(content, content);
      setSelectedPath(created);
      setEditorMode("code");
      setToast(`Arquivo ${created} criado.`);
    } catch {
      setToast("Falha ao criar o arquivo.");
    }
  }

  async function newFolderRoot() {
    const raw = window.prompt("Nome da pasta (na raiz):");
    if (raw === null) return;
    const name = validName(raw);
    if (!name) {
      setToast("Nome inválido.");
      return;
    }
    try {
      await createDirEntry(repo, "", name);
      setToast(`Pasta ${name} criada.`);
    } catch {
      setToast("Falha ao criar a pasta.");
    }
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-surface-600 bg-surface-900/70 md:flex">
      <div className="sticky top-0 z-10 border-b border-surface-600 bg-surface-900 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Explorador · {repo}</span>
          <span className="flex items-center gap-1">
            <button onClick={() => void newFileRoot()} title="Novo arquivo (raiz)" className="rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-100 touch-manipulation">
              <FilePlus2 className="h-4 w-4" />
            </button>
            <button onClick={() => void newFolderRoot()} title="Nova pasta (raiz)" className="rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-100 touch-manipulation">
              <FolderPlus className="h-4 w-4" />
            </button>
          </span>
        </div>
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