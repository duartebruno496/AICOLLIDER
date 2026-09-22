import { useCallback, useEffect, useState } from "react";
import { FolderGit2, Loader2, Download, Copy, Plus } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { listTopLevelDirs } from "../lib/fs";
import { cloneRepo, normalizeRepoUrl, createLocalProject } from "../lib/git";
import { refreshStorageInfo } from "../lib/workspace";
import { Button, Field, inputCls } from "./common";
import { StoragePanel } from "./StoragePanel";
import { SettingsModal } from "./SettingsModal";
import { loadRepoMeta, saveRepoMeta } from "../lib/repoMeta";

export function ProjectWizard() {
  const { gitToken, gitUsername, setActiveRepo, setRepositoryUrl, setTree, setSelectedPath, setContents, setToast, setStorage, setShowSyncModal } = useAppStore();
  const [url, setUrl] = useState("");
  const [dirs, setDirs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number; phase: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadDirs = useCallback(async () => {
    const info = await refreshStorageInfo(false);
    setStorage(info);
    setDirs(await listTopLevelDirs());
  }, [setStorage]);

  useEffect(() => {
    void loadDirs();
  }, [loadDirs]);

  const deriveDirName = (u: string) => {
    const m = normalizeRepoUrl(u).replace(/\.git$/, "").split("/");
    return m[m.length - 1] ?? "repositorio";
  };

  async function handleClone() {
    if (!url.trim() || !gitToken) {
      setError(gitToken ? "Cole a URL do repositório." : "Você precisa estar logado com GitHub para clonar repositórios.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ loaded: 0, total: 0, phase: "iniciando" });
    try {
      const dir = deriveDirName(url);
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Bem-vindo ao AICOLLIDER</h1>
        <p className="mt-1 text-sm text-slate-400">
          Comece rápido: crie um projeto local agora (sem login) e edite no navegador — ou conecte o GitHub para
          clonar/atualizar repositórios.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
          <Plus className="h-4 w-4" />
          Criar novo projeto local (rápido)
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Sem conta, sem API key, sem servidor. Inicia um repositório git local com um README e abre no editor na hora.
        </p>
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="Nome do projeto (ex.: minha-landing)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !creating && void handleCreateLocal()}
          />
          <Button onClick={() => void handleCreateLocal()} disabled={creating || !newName.trim()} variant="success" className="shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar e abrir
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Download className="h-4 w-4 text-sky-400" />
          Clonar repositório para o navegador
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {gitToken
            ? `Conectado como ${gitUsername ?? gitToken.slice(0, 8)}. Cole a URL de um repositório (público ou privado).`
            : "Clone 100% local via IndexedDB. Requer login com GitHub."}
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
          <FolderGit2 className="h-4 w-4 text-emerald-400" />
          Abrir repositório local existente
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