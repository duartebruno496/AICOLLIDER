import { VFS, writeFile, deletePath } from "./fs";
import { commitAll } from "./git";
import { refreshWorkspace } from "./workspace";
import { useAppStore } from "../store/useAppStore";

function repoAuthor() {
  const { gitUsername } = useAppStore.getState();
  return {
    name: gitUsername ?? "AICOLLIDER",
    email: `${gitUsername ?? "aicollider"}@users.noreply.github.com`,
  };
}

/** Converte um caminho absoluto como /repo/a/b num caminho relativo a/b. */
export function toRel(repo: string, abs: string): string {
  return abs.replace(new RegExp(`^/${repo}/?`), "");
}

export async function createFileEntry(repo: string, dirAbs: string, name: string, content = ""): Promise<string> {
  const rel = dirAbs ? `${toRel(repo, dirAbs)}/${name}` : name;
  await writeFile(`/${repo}/${rel}`, content);
  await commitAll(repo, `AICOLLIDER: cria ${rel}`, repoAuthor());
  await refreshWorkspace(repo);
  return rel;
}

export async function createDirEntry(repo: string, dirAbs: string, name: string): Promise<string> {
  const rel = dirAbs ? `${toRel(repo, dirAbs)}/${name}` : name;
  await VFS.promises.mkdir(`/${repo}/${rel}`).catch(() => undefined);
  await refreshWorkspace(repo);
  return rel;
}

export async function renameEntry(repo: string, abs: string, newName: string): Promise<string> {
  const parent = abs.includes("/") ? abs.slice(0, abs.lastIndexOf("/")) : `/${repo}`;
  const dest = `${parent}/${newName}`;
  await VFS.promises.rename(abs, dest);
  const rel = toRel(repo, dest);
  await commitAll(repo, `AICOLLIDER: renomeia ${toRel(repo, abs)} -> ${rel}`, repoAuthor());
  await refreshWorkspace(repo);
  return rel;
}

export async function deleteEntry(repo: string, abs: string): Promise<void> {
  await deletePath(abs);
  await commitAll(repo, `AICOLLIDER: remove ${toRel(repo, abs)}`, repoAuthor());
  await refreshWorkspace(repo);
}

export interface ImportFile {
  rel: string;
  content: string;
}

/** Normaliza um caminho relativo vindo de upload/arrastar (defesa contra `..`, `/` absoluto e `\`). Retorna null se inválido. */
export function normalizeImportRel(rel: string): string | null {
  const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
  const clean: string[] = [];
  for (const p of parts) {
    if (p === "." || p === "..") return null;
    clean.push(p);
  }
  return clean.length > 0 ? clean.join("/") : null;
}

/** Retorna os rels que já existem dentro do repo (para confirmar sobrescrita antes do import). */
export async function existingPaths(repo: string, rels: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const r of rels) {
    try {
      await VFS.promises.stat(`/${repo}/${r}`);
      out.push(r);
    } catch {
      /* não existe */
    }
  }
  return out;
}

/** Grava vários arquivos de uma vez + um único commit + refresh da árvore. Rel inválido/binário é ignorado. */
export async function importFiles(repo: string, files: ImportFile[]): Promise<number> {
  const safe: ImportFile[] = [];
  for (const f of files) {
    const rel = normalizeImportRel(f.rel);
    if (!rel || f.content.includes("\u0000")) continue;
    safe.push({ rel, content: f.content });
  }
  if (!safe.length) return 0;
  for (const f of safe) await writeFile(`/${repo}/${f.rel}`, f.content);
  await commitAll(repo, `AICOLLIDER: importa arquivos (${safe.length})`, repoAuthor());
  await refreshWorkspace(repo);
  return safe.length;
}