import type { PendingChange } from "../types";
import { readFile as readVFS, writeFile, VFS, readDir } from "../lib/fs";
import { buildTree, refreshWorkspace } from "../lib/workspace";
import { commitAll } from "../lib/git";
import { githubGetTree, githubGetFile } from "../lib/githubApi";
import { useAppStore } from "../store/useAppStore";

function normalize(p: string): string {
  let path = p.replace(/^\/+/, "");
  const parts = path.split("/").filter((s) => s && s !== "." && s !== "..");
  return parts.join("/");
}

function parseRepo(ref: string): { owner: string; repo: string } | null {
  const m = ref.trim().replace(/\.git$/i, "").split("/");
  if (m.length !== 2) return null;
  const [owner, repo] = m;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
  return { owner, repo };
}

const SEARCH_IGNORED = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".turbo"]);
const MAX_SEARCH_FILES = 60;
const MAX_SEARCH_LINES_PER_FILE = 20;
const MAX_SEARCH_BYTES = 256 * 1024;

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

  async readFile(rawPath: string, from?: number, to?: number): Promise<string> {
    const p = this.rel(rawPath);
    if (!p) return "Informe um caminho de arquivo.";
    try {
      const text = (await readVFS(this.abs(p))).toString();
      if (text.includes("\u0000")) return `'${p}' parece ser um arquivo binário; não consigo ler como texto.`;
      if (from === undefined) return text;
      const f = Math.max(1, Math.floor(from));
      const t = to === undefined ? f + 200 : Math.max(f, Math.floor(to));
      return text
        .split("\n")
        .slice(f - 1, t)
        .map((l, i) => `${f + i}: ${l}`)
        .join("\n");
    } catch {
      return `Não consegui ler '${p}'. Verifique o caminho com listFiles.`;
    }
  }

  async searchCode(rawTerm: string, rawPath = ""): Promise<string> {
    const term = (rawTerm ?? "").trim();
    if (!term) return "Informe um termo de busca.";
    const needle = term.toLowerCase();
    const root = this.rel(rawPath);
    const files: string[] = [];
    const collect = async (path: string, rel: string) => {
      const entries = await readDir(path);
      for (const e of entries) {
        if (e.kind === "dir") {
          if (SEARCH_IGNORED.has(e.name)) continue;
          await collect(e.path, rel ? `${rel}/${e.name}` : e.name);
        } else {
          files.push(rel ? `${rel}/${e.name}` : e.name);
        }
      }
    };
    await collect(this.abs(root), root);

    const out: string[] = [];
    let hits = 0;
    let lastRel: string | null = null;
    for (const rel of files) {
      if (hits >= MAX_SEARCH_FILES) break;
      let text = "";
      try {
        const st = await VFS.promises.stat(`/${this.repo}/${rel}`);
        if ((st.size ?? 0) > MAX_SEARCH_BYTES) continue;
        text = (await readVFS(`/${this.repo}/${rel}`)).toString();
      } catch {
        continue;
      }
      if (text.includes("\u0000")) continue;
      const lines = text.split("\n");
      let per = 0;
      lines.forEach((line, i) => {
        if (per >= MAX_SEARCH_LINES_PER_FILE || hits >= MAX_SEARCH_FILES) return;
        if (line.toLowerCase().includes(needle)) {
          if (lastRel !== rel) {
            out.push(`# ${rel}`);
            lastRel = rel;
          }
          out.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`);
          per += 1;
          hits += 1;
        }
      });
    }
    return out.length > 0 ? out.join("\n") : `Nada encontrado para "${term}"${rawPath ? ` em ${rawPath}` : ""}.`;
  }

  async githubListFiles(repoRef: string, ref?: string): Promise<string> {
    const token = useAppStore.getState().gitToken;
    const parsed = parseRepo(repoRef);
    if (!parsed) return "Formato de repositório inválido. Use 'dono/nome' (ex.: 'facebook/react').";
    if (!token) return "Sem login do GitHub — o acesso a repositórios remotos requer login (Dashboard > Conta & Sync).";
    try {
      const tree = await githubGetTree(token, parsed.owner, parsed.repo, ref ?? "HEAD");
      const lines = tree
        .filter((t) => t.type === "blob")
        .slice(0, 300)
        .map((t) => `📄 ${t.path}${t.size ? ` (${t.size} B)` : ""}`);
      return lines.length > 0 ? `Árvore de ${parsed.owner}/${parsed.repo}${ref ? ` @${ref}` : ""}:\n${lines.join("\n")}` : "Repositório vazio ou privado sem acesso.";
    } catch (e) {
      return `Erro ao listar remoto: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async githubReadFile(repoRef: string, path: string, ref?: string): Promise<string> {
    const token = useAppStore.getState().gitToken;
    const parsed = parseRepo(repoRef);
    if (!parsed) return "Formato de repositório inválido. Use 'dono/nome' (ex.: 'facebook/react').";
    if (!token) return "Sem login do GitHub — o acesso a repositórios remotos requer login (Dashboard > Conta & Sync).";
    const rel = normalize(path);
    if (!rel) return "Caminho inválido.";
    try {
      return await githubGetFile(token, parsed.owner, parsed.repo, rel, ref ?? "HEAD");
    } catch (e) {
      return `Erro ao ler '${rel}': ${e instanceof Error ? e.message : String(e)}`;
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