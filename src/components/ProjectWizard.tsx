import { useCallback, useEffect, useState } from "react";
import { FolderGit2, Loader2, Download, Copy, Plus, Github, RefreshCw, Lock, Globe, FileCode2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { listTopLevelDirs } from "../lib/fs";
import { cloneRepo, createLocalProject } from "../lib/git";
import { refreshStorageInfo } from "../lib/workspace";
import { Button, Field, inputCls } from "./common";
import { StoragePanel } from "./StoragePanel";
import { SettingsModal } from "./SettingsModal";
import { loadRepoMeta, saveRepoMeta } from "../lib/repoMeta";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  clone_url: string;
  updated_at: string;
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "agora";
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d`;
  } catch {
    return "";
  }
}

export function ProjectWizard() {
  const { gitToken, gitUsername, setActiveRepo, setRepositoryUrl, setTree, setSelectedPath, setContents, setToast, setStorage, setShowSyncModal } = useAppStore();
  const [url, setUrl] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number; phase: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [ghRepos, setGhRepos] = useState<GitHubRepo[] | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghRepoName, setGhRepoName] = useState("");
  const [ghPrivate, setGhPrivate] = useState(false);
  const [ghCreating, setGhCreating] = useState(false);

  const loadDirs = useCallback(async () => {
    const info = await refreshStorageInfo(false);
    setStorage(info);
    setDirs(await listTopLevelDirs());
  }, [setStorage]);

  useEffect(() => {
    void loadDirs();
  }, [loadDirs]);

  const fetchRepos = useCallback(async () => {
    if (!gitToken) {
      setGhRepos(null);
      return;
    }
    setGhLoading(true);
    setError(null);
    try {
      const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member", {
        headers: { Authorization: `Bearer ${gitToken}`, Accept: "application/vnd.github+json", "User-Agent": "aicollider" },
      });
      if (!res.ok) {
        setGhRepos([]);
        throw new Error(`Erro ao buscar repositórios (HTTP ${res.status}). O token precisa do escopo 'repo'.`);
      }
      const list = (await res.json()) as GitHubRepo[];
      setGhRepos(list);
    } catch (e) {
      setGhRepos([]);
      setError(e instanceof Error ? e.message : "Falha ao buscar repositórios do GitHub.");
    } finally {
      setGhLoading(false);
    }
  }, [gitToken]);

  useEffect(() => {
    void fetchRepos();
  }, [fetchRepos]);

  async function cloneWithProgress(repoUrl: string, dir: string) {
    setBusy(true);
    setProgress({ loaded: 0, total: 0, phase: "iniciando" });
    try {
      await cloneRepo(repoUrl, dir, gitToken!, (p) => setProgress({ loaded: p.loaded, total: p.total, phase: p.phase }));
      setProgress({ loaded: 0, total: 0, phase: "concluído" });
    } finally {
      await loadDirs();
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleClone() {
    if (!url.trim() || !gitToken) {
      setError(gitToken ? "Cole a URL do repositório." : "Você precisa estar logado com GitHub para clonar repositórios.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ loaded: 0, total: 0, phase: "iniciando" });
    try {
      const dir = url.replace(/\.git$/, "").split("/").pop() ?? "repositorio";
      await cloneRepo(url, dir, gitToken, (p) => setProgress({ loaded: p.loaded, total: p.total, phase: p.phase }));
      setProgress({ loaded: 0, total: 0, phase: "concluído" });
      await loadDirs();
      setToast(`Repositório "${dir}" clonado para o navegador.`);
      openRepo(dir, url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no clone. Verifique a permissão do token (escopo 'repo') e a URL.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleOpenRepo(r: GitHubRepo) {
    setError(null);
    if (dirs.includes(r.name)) {
      openRepo(r.name);
      return;
    }
    setProgress({ loaded: 0, total: 0, phase: "clonando" });
    try {
      await cloneWithProgress(r.clone_url, r.name);
      setToast(`Repositório "${r.name}" clonado.`);
      openRepo(r.name, r.clone_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Falha ao clonar ${r.full_name}. Verifique o escopo 'repo' do token.`);
    }
  }

  async function handleCreateLocal() {
    const raw = newName.trim();
    const slug = raw
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    if (!slug) {
      setError("Dê um nome ao projeto (ex.: minha-landing).");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createLocalProject(slug);
      await loadDirs();
      setToast(`Projeto local "${slug}" criado e pronto para editar.`);
      openRepo(slug, null);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar o projeto local.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateGithub() {
    if (!gitToken) {
      setError("Entre com a conta GitHub primeiro.");
      return;
    }
    const raw = ghRepoName.trim();
    const slug = raw
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    if (!slug) {
      setError("Dê um nome ao repositório.");
      return;
    }
    setGhCreating(true);
    setError(null);
    try {
      const res = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: { Authorization: `Bearer ${gitToken}`, Accept: "application/vnd.github+json", "User-Agent": "aicollider", "Content-Type": "application/json" },
        body: JSON.stringify({ name: slug, private: ghPrivate, description: "Criado pelo AICOLLIDER" }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Falha ao criar o repositório (HTTP ${res.status}): ${t.slice(0, 200)}`);
      }
      const created = (await res.json()) as GitHubRepo;
      await createLocalProject(slug);
      await loadDirs();
      setToast(`Repositório "${slug}" criado no GitHub e aberto no editor.`);
      openRepo(slug, created.clone_url);
      setGhRepoName("");
      await fetchRepos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar o repositório no GitHub.");
    } finally {
      setGhCreating(false);
    }
  }

  async function openRepo(dir: string, repoUrl?: string | null) {
    const meta = await loadRepoMeta(dir);
    const url = repoUrl ?? meta?.repositoryUrl ?? null;
    setActiveRepo(dir);
    setRepositoryUrl(url);
    void saveRepoMeta(dir, { repositoryUrl: url });
    setTree([]);
    setSelectedPath(null);
    setContents("", "");
    setShowSyncModal(true);
  }

  const progressPct = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  const clonedDirs = new Set(dirs);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Bem-vindo ao AICOLLIDER</h1>
        <p className="mt-1 text-sm text-slate-400">
          {gitUsername
            ? `Logado como ${gitUsername}. Abra um dos seus repositórios do GitHub, crie um novo ou um projeto local.`
            : "Entre com sua conta GitHub para acessar seus projetos."}
        </p>
      </div>

      {gitToken && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <Github className="h-4 w-4" /> Seus repositórios no GitHub
            </h2>
            <button onClick={() => void fetchRepos()} className="rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-100 touch-manipulation" title="Recarregar">
              <RefreshCw className={`h-4 w-4 ${ghLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {ghLoading && !ghRepos ? (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando repositórios...
            </p>
          ) : ghRepos && ghRepos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum repositório encontrado nesta conta.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {ghRepos?.map((r) => (
                <li key={r.id ?? r.full_name}>
                  <button
                    onClick={() => void handleOpenRepo(r)}
                    disabled={busy}
                    className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-surface-600 bg-surface-900/70 px-3 py-2 text-left hover:border-emerald-500 disabled:opacity-50 touch-manipulation"
                  >
                    <FolderGit2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-slate-100">
                        {r.name} {r.private ? <Lock className="mb-0.5 inline h-3 w-3 text-amber-400" /> : <Globe className="mb-0.5 inline h-3 w-3 text-slate-500" />}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{r.description ?? r.full_name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500">{clonedDirs.has(r.name) ? "abrir" : timeAgo(r.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Plus className="h-4 w-4 text-emerald-400" />
          Criar novo projeto
        </h2>
        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr]">
          <div>
            <p className="mb-2 text-xs text-slate-400">Projeto local (rápido, sem GitHub):</p>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="minha-landing"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creating && void handleCreateLocal()}
              />
              <Button onClick={() => void handleCreateLocal()} disabled={creating || !newName.trim()} className="shrink-0">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Local
              </Button>
            </div>
          </div>
          {gitToken ? (
            <div className="hidden items-center text-xs text-slate-600 md:flex">ou</div>
          ) : null}
          {gitToken && (
            <div>
              <p className="mb-2 text-xs text-slate-400">No GitHub (fica na sua conta):</p>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="meu-novo-repo"
                  value={ghRepoName}
                  onChange={(e) => setGhRepoName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !ghCreating && void handleCreateGithub()}
                />
                <Button onClick={() => void handleCreateGithub()} disabled={ghCreating || !ghRepoName.trim()} variant="success" className="shrink-0">
                  {ghCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                  GitHub
                </Button>
              </div>
              <label className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 touch-manipulation">
                <input type="checkbox" checked={ghPrivate} onChange={(e) => setGhPrivate(e.target.checked)} className="h-3.5 w-3.5 accent-amber-500" />
                privado
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Download className="h-4 w-4 text-sky-400" />
          Clonar repositório por URL
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {gitToken ? `Conectado como ${gitUsername ?? gitToken.slice(0, 8)}. Cole a URL de qualquer repositório.` : "Clone 100% local via IndexedDB. Requer login com GitHub."}
        </p>
        <div className="mt-3">
          <Field label="URL do repositório GitHub" hint="Ex.: https://github.com/usuario/meu-projeto.git ou git@github.com:usuario/meu-projeto.git">
            <input
              className={inputCls}
              placeholder="https://github.com/usuario/meu-repo.git"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && void handleClone()}
            />
          </Field>
          <Button onClick={() => void handleClone()} disabled={busy || !url.trim()} className="mt-3 w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? "Clonando..." : "Clonar para o navegador"}
          </Button>
        </div>
        {progress && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span className="capitalize">{progress.phase}</span>
              <span>
                {progress.total > 0 ? progressPct : ""} {progress.loaded > 0 ? `${(progress.loaded / 1024 / 1024).toFixed(1)} MiB` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-700">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress.total > 0 ? progressPct : 25}%` }} />
            </div>
          </div>
        )}
      </div>

      {error && <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}

      <div className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FileCode2 className="h-4 w-4 text-emerald-400" />
          Abrir projeto local existente
        </h2>
        {dirs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum projeto local ainda. Crie um acima ou clone um repositório.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dirs.map((d) => (
              <li key={d}>
                <button
                  onClick={() => void openRepo(d)}
                  className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-surface-600 bg-surface-900 px-3 py-2 text-left font-mono text-sm text-slate-100 hover:border-sky-500 touch-manipulation"
                >
                  <Copy className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate">{d}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Gerenciamento de armazenamento</h2>
        <StoragePanel onDirRemoved={() => void loadDirs()} />
      </div>

      <SettingsModal />
    </div>
  );
}