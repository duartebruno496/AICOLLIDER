import type { PendingChange } from "../types";
import { readFile as readVFS, writeFile, VFS } from "../lib/fs";
import { buildTree, refreshWorkspace } from "../lib/workspace";
import { commitAll } from "../lib/git";
import { useAppStore } from "../store/useAppStore";

function normalize(p: string): string {
  let path = p.replace(/^\/+/, "");
  const parts = path.split("/").filter((s) => s && s !== "." && s !== "..");
  return parts.join("/");
}

export class CoderAgent {
  constructor(private repo: string) {}

  private rel(path: string): string {
    return normalize(path);
  }

  private abs(path: string): string {
    return `/${this.repo}/${this.rel(path)}`;
  }

  async listFiles(rawPath = ""): Promise<string> {
    const parts = this.rel(rawPath);
    const tree = await buildTree(this.repo);
    const build = (nodes: typeof tree, prefix: string): string[] => {
      let lines: string[] = [];
      for (const n of nodes) {
        const rel = n.path.replace(new RegExp(`^/${this.repo}/?`), "");
        if (n.kind === "dir") {
          lines.push(`📁 ${rel}/`);
          if (n.children) lines = lines.concat(build(n.children, rel));
        } else {
          lines.push(`📄 ${rel}`);
        }
      }
      return lines;
    };
    let lines: string[] = [];
    if (!parts) {
      lines = build(tree, "");
    } else {
      const dirPath = `/${this.repo}/${parts}`;
      const stat = await VFS.promises.stat(dirPath).catch(() => null);
      if (!stat || !stat.isDirectory()) {
        return `Diretório '${parts}' não encontrado. Liste por exemplo: ${build(tree, "").slice(0, 20).join(", ")}`;
      }
      const entries = await buildTree(`${this.repo}/${parts}`);
      lines = build(entries, parts);
    }
    return lines.length ? lines.join("\n") : "(diretório vazio)";
  }

  async readFile(rawPath: string): Promise<string> {
    const p = this.rel(rawPath);
    if (!p) return "Informe um caminho de arquivo.";
    try {
      return (await readVFS(this.abs(p))).toString();
    } catch {
      return `Não consegui ler '${p}'. Verifique o caminho com listFiles.`;
    }
  }

  async captureChange(rawPath: string, content: string): Promise<PendingChange> {
    const p = this.rel(rawPath);
    let original = "";
    try {
      original = (await readVFS(this.abs(p))).toString();
    } catch {
      original = "";
    }
    return { path: p, original, modified: content, fromAgent: true };
  }

  /** Só pode ser chamado APÓS a aprovação humana. */
  async applyApprovedChange(change: PendingChange): Promise<void> {
    await writeFile(this.abs(change.path), change.modified);
    const { gitUsername, gitToken } = useAppStore.getState();
    const author = {
      name: gitUsername ?? "AICOLLIDER",
      email: `${gitUsername ?? "aicollider"}@users.noreply.github.com`,
    };
    await commitAll(this.repo, `AICOLLIDER: ${change.path}${gitToken ? "" : " (local)"}`, author);
    await refreshWorkspace(this.repo);
  }

  async createWorkflow(name: string, yaml: string): Promise<PendingChange> {
    const safeName = normalize(name).replace(/\.ya?ml$/i, "") + ".yml";
    const path = `.github/workflows/${safeName}`;
    return this.captureChange(path, yaml);
  }
}