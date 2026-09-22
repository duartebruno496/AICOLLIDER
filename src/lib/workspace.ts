import { readDir, VFS, readFile } from "./fs";
import type { TreeNode } from "../types";
import { useAppStore } from "../store/useAppStore";

const MAX_TREE_DEPTH = 4;
const IGNORED = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

export async function buildTree(root: string): Promise<TreeNode[]> {
  const walk = async (path: string, depth: number): Promise<TreeNode[]> => {
    if (depth > MAX_TREE_DEPTH) return [];
    const entries = await readDir(path);
    const nodes: TreeNode[] = [];
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue;
      if (e.kind === "dir") {
        nodes.push({
          name: e.name,
          path: e.path,
          kind: "dir",
          children: await walk(e.path, depth + 1),
        });
      } else {
        nodes.push({ name: e.name, path: e.path, kind: "file" });
      }
    }
    return nodes;
  };
  return walk(`/${root}`, 0);
}

export async function calcDirSize(path: string): Promise<number> {
  let total = 0;
  const walk = async (p: string) => {
    const entries = await readDir(p).catch(() => [] as { path: string; kind: "file" | "dir" }[]);
    for (const e of entries) {
      if (e.kind === "dir") {
        await walk(e.path);
      } else {
        try {
          const stat = await VFS.promises.stat(e.path);
          total += stat.size ?? 0;
        } catch {
          /* ignore */
        }
      }
    }
  };
  await walk(`/${path}`);
  return total;
}

export async function refreshStorageInfo(recalcDirs: boolean): Promise<{
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usagePercent: number;
  overWarning: boolean;
  overLimit: boolean;
}> {
  const est = await navigator.storage.estimate();
  const usageBytes = est.usage ?? 0;
  const quotaBytes = est.quota ?? 5 * 1024 * 1024 * 1024;
  const availableBytes = Math.max(0, quotaBytes - usageBytes);
  const usagePercent = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
  const limit = quotaBytes > 0 ? quotaBytes : 5 * 1024 * 1024 * 1024;
  const overWarning = usageBytes > limit * 0.9; // 4.5GB de 5GB
  const overLimit = usageBytes >= limit;
  void recalcDirs;
  return { usageBytes, quotaBytes, availableBytes, usagePercent, overWarning, overLimit };
}

export function prettyBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Recarrega a árvore de arquivos e, se o arquivo selecionado mudou, recarrega o conteúdo no editor. */
export async function refreshWorkspace(repo: string): Promise<void> {
  const state = useAppStore.getState();
  const tree = await buildTree(repo);
  state.setTree(tree);
  const selected = state.selectedPath;
  if (selected) {
    try {
      const rel = selected.replace(new RegExp(`^/${repo}/?`), "");
      const content = await readFile(`/${repo}/${rel}`);
      state.setContents(content, content);
    } catch {
      state.setSelectedPath(null);
    }
  }
}