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