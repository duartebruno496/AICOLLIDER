const API = "https://api.github.com";

export interface GithubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export interface GithubRepoSummary {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  description: string | null;
}

function tokenHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh(url: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...tokenHeaders(token), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`GitHub ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res;
}

/** Repositórios do usuário autenticado (owner + colaborador + orgs), por atualização. */
export async function githubListUserRepos(token: string, perPage = 30): Promise<GithubRepoSummary[]> {
  const res = await gh(`${API}/user/repos?per_page=${perPage}&sort=updated&affiliation=owner,collaborator,organization_member`, token);
  const list = (await res.json()) as Array<{ full_name: string; html_url: string; default_branch: string; description: string | null }>;
  return list.map((r) => ({
    fullName: r.full_name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch ?? "main",
    description: r.description ?? null,
  }));
}

/** Árvore completa (recursiva) de um repo/branch/commit, sem clonar. */
export async function githubGetTree(token: string, owner: string, repo: string, ref = "HEAD"): Promise<GithubTreeEntry[]> {
  const res = await gh(`${API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token);
  const json = (await res.json()) as { tree?: Array<{ path: string; type: string; size?: number }>; truncated?: boolean };
  return (json.tree ?? [])
    .filter((t): t is { path: string; type: "blob" | "tree"; size?: number } => t.type === "blob" || t.type === "tree")
    .map((t) => ({ path: t.path, type: t.type, size: t.size }));
}

/** Conteúdo texto de um arquivo num repo do GitHub (via contents API; suporta público e privado com token). */
export async function githubGetFile(token: string, owner: string, repo: string, path: string, ref = "HEAD"): Promise<string> {
  const clean = path
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .map(encodeURIComponent)
    .join("/");
  const res = await gh(`${API}/repos/${owner}/${repo}/contents/${clean}?ref=${encodeURIComponent(ref)}`, token);
  const json = (await res.json()) as { content?: string; message?: string; encoding?: string };
  if (typeof json.content !== "string") throw new Error(json.message ?? "Arquivo não encontrado.");
  if (json.encoding === "base64") {
    const bin = (json.content.match(/[A-Za-z0-9+/=]/g) ?? []).join("");
    const bytes = Uint8Array.from(atob(bin), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  throw new Error("Formato de conteúdo não suportado.");
}