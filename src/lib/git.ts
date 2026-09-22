import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { VFS, writeFile } from "./fs";

function auth(token: string) {
  return {
    username: token,
    password: "x-oauth-basic",
  };
}

/** Converte uma URL do GitHub (https://github.com/u/r.git) para clone HTTPS autenticável. */
export function normalizeRepoUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//.test(u)) {
    u = u.replace(/^git@github\.com:?/, "https://github.com/");
    if (!/^https?:\/\//.test(u)) u = `https://github.com/${u}`;
  }
  if (/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?\/?$/.test(u)) {
    const m = u.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?\/?$/);
    if (m) u = `https://github.com/${m[1]}/${m[2]}.git`;
  }
  return u;
}

export async function cloneRepo(url: string, dir: string, token: string, onProgress?: (p: { phase: string; loaded: number; total: number }) => void) {
  return git.clone({
    fs: VFS,
    http,
    url: normalizeRepoUrl(url),
    dir: `/${dir}`,
    corsProxy: "https://cors.isomorphic-git.org",
    singleBranch: true,
    depth: 10,
    onAuth: () => auth(token),
    onProgress,
  });
}

export async function commitAll(dir: string, message: string, author: { name: string; email: string }) {
  const files = await git.statusMatrix({ fs: VFS, dir: `/${dir}` });
  for (const [filepath, head, workdir, stage] of files) {
    if (head === 0 && workdir === 0) continue;
    if (stage === 0) {
      if (head !== 0) await git.remove({ fs: VFS, dir: `/${dir}`, filepath });
    } else {
      await git.add({ fs: VFS, dir: `/${dir}`, filepath });
    }
  }
  const oid = await git.commit({
    fs: VFS,
    dir: `/${dir}`,
    message,
    author,
    committer: author,
  });
  return oid;
}

export async function pushBranch(dir: string, token: string) {
  await git.push({
    fs: VFS,
    http,
    dir: `/${dir}`,
    corsProxy: "https://cors.isomorphic-git.org",
    onAuth: () => auth(token),
  });
}

export async function pullBranch(dir: string, token: string, onProgress?: (p: { phase: string; loaded: number; total: number }) => void) {
  await git.pull({
    fs: VFS,
    http,
    dir: `/${dir}`,
    corsProxy: "https://cors.isomorphic-git.org",
    singleBranch: true,
    onAuth: () => auth(token),
    onProgress,
    author: { name: "AICOLLIDER", email: "aicollider@local" },
  });
}

export async function logRepo(dir: string) {
  return git.log({ fs: VFS, dir: `/${dir}`, depth: 30 });
}

export async function resolveLocalHead(dir: string): Promise<string | undefined> {
  try {
    return await git.resolveRef({ fs: VFS, dir: `/${dir}`, ref: "HEAD" });
  } catch {
    return undefined;
  }
}

export async function getRemoteHeadRefs(dir: string): Promise<Record<string, string>> {
  try {
    const listRefs = (git as unknown as Record<string, unknown>).listRefs as unknown as (opts: {
      fs: unknown;
      http: unknown;
      corsProxy: string;
      dir: string;
      ref: string;
    }) => Promise<Array<{ ref: string; oid: string }>>;
    const refs = await listRefs({ fs: VFS, http, corsProxy: "https://cors.isomorphic-git.org", dir: `/${dir}`, ref: "refs/heads" });
    return Object.fromEntries(refs.map((r) => [r.ref, r.oid]));
  } catch {
    return {};
  }
}

export async function getAheadBehind(dir: string): Promise<{ ahead: number; behind: number }> {
  const [localBranch, remoteRef] = await Promise.all([
    git.currentBranch({ fs: VFS, dir: `/${dir}`, fullname: false }).catch(() => "main" as string | void),
    git.currentBranch({ fs: VFS, dir: `/${dir}`, fullname: true }).catch(async () => {
      const b = await git.currentBranch({ fs: VFS, dir: `/${dir}`, fullname: false }).catch(() => "main" as string | void);
      return `refs/remotes/origin/${b ?? "main"}`;
    }),
  ]);
  const calcOids = (git as unknown as Record<string, unknown>).calcOids as unknown as (opts: {
    fs: unknown;
    dir: string;
    localRef: string;
    remoteRef: string;
  }) => Promise<{ ahead: number; behind: number }>;
  const count = await calcOids({
    fs: VFS,
    dir: `/${dir}`,
    localRef: `refs/heads/${localBranch ?? "main"}`,
    remoteRef: remoteRef ?? "refs/remotes/origin/main",
  });
  return { ahead: count.ahead, behind: count.behind };
}

export async function undoLastCommit(dir: string): Promise<string> {
  const before = await resolveLocalHead(dir);
  const reset = (git as unknown as Record<string, unknown>).reset as unknown as (opts: {
    fs: unknown;
    dir: string;
    ref: string;
    hard: boolean;
  }) => Promise<void>;
  await reset({ fs: VFS, dir: `/${dir}`, ref: "HEAD~1", hard: true });
  const after = await resolveLocalHead(dir);
  return `${before} -> ${after}`;
}

/** Compare local HEAD vs remote branch (Kindle-style sync check). */
export async function detectSyncState(dir: string): Promise<"in-sync" | "behind" | "ahead" | "diverged" | "unknown"> {
  try {
    const local = await resolveLocalHead(dir);
    if (!local) return "unknown";
    const head = await git
      .currentBranch({ fs: VFS, dir: `/${dir}`, fullname: true })
      .catch(async () => {
        const b = await git.currentBranch({ fs: VFS, dir: `/${dir}`, fullname: false }).catch(() => "main" as string | void);
        return `refs/remotes/origin/${b ?? "main"}`;
      });
    const refOid = await git.resolveRef({ fs: VFS, dir: `/${dir}`, ref: head ?? "refs/remotes/origin/main" }).catch(() => undefined as string | undefined);
    if (!refOid) return "unknown";
    if (local === refOid) return "in-sync";
    const { ahead, behind } = await getAheadBehind(dir);
    if (behind > 0 && ahead > 0) return "diverged";
    if (behind > 0) return "behind";
    if (ahead > 0) return "ahead";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function safeCurrentBranch(dir: string): Promise<string> {
  return ((await git.currentBranch({ fs: VFS, dir: `/${dir}` }).catch(() => "main" as string | void)) ?? "main") as string;
}

const AICOLLIDER_AUTHOR = { name: "AICOLLIDER", email: "aicollider@local" };

/** Cria um repositório git 100% local (sem remote) com um README inicial. */
export async function createLocalProject(name: string): Promise<string> {
  const dir = `/${name}`;
  try {
    await VFS.promises.mkdir(dir);
  } catch {
    /* diretório já existe */
  }
  await git.init({ fs: VFS, dir });
  const head = await resolveLocalHead(name);
  if (!head) {
    await writeFile(`/${name}/README.md`, `# ${name}\n\nProjeto local criado no AICOLLIDER.\n\nEdite os arquivos aqui ou peça à IA no chat (modo agente).\n`);
    await git.add({ fs: VFS, dir, filepath: "README.md" });
    await git.commit({
      fs: VFS,
      dir,
      message: `chore: inicia projeto local ${name}`,
      author: AICOLLIDER_AUTHOR,
      committer: AICOLLIDER_AUTHOR,
    });
  }
  return name;
}