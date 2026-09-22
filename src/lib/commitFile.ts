import { useAppStore } from "../store/useAppStore";
import { writeFile } from "./fs";
import { commitAll } from "./git";
import { refreshWorkspace } from "./workspace";

/** Grava o conteúdo aprovado pelo humano e gera um commit automático. */
export async function persistManualChange(repo: string, path: string, content: string): Promise<void> {
  await writeFile(`/${repo}/${path}`, content);
  const { gitUsername } = useAppStore.getState();
  const author = {
    name: gitUsername ?? "AICOLLIDER",
    email: `${gitUsername ?? "aicollider"}@users.noreply.github.com`,
  };
  await commitAll(repo, `AICOLLIDER: ${path}`, author);
  await refreshWorkspace(repo);
}