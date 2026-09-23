import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Cpu,
  Cloud,
  ShieldCheck,
  Github,
  LogOut,
  Gauge,
  Bot,
  FolderGit2,
  Download,
  Plus,
  RefreshCw,
  Search,
  Lock,
  Globe,
  Trash2,
  HardDrive,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { ApiKeys, RemoteVendor } from "../types";
import { DEFAULT_MODELS, DEFAULT_AGENT_CONFIG, SCRATCH_REPO } from "../types";
import { Field, Button, inputCls } from "./common";
import { AutonomyPicker, AUTONOMY_HINTS } from "./AutonomyPicker";
import { AgentsPanel } from "./AgentsPanel";
import { signOut } from "../lib/auth";
import { listTopLevelDirs, deletePath } from "../lib/fs";
import { cloneRepo, createLocalProject } from "../lib/git";
import { refreshStorageInfo, prettyBytes, calcDirSize } from "../lib/workspace";
import { loadRepoMeta, saveRepoMeta } from "../lib/repoMeta";
import { StoragePanel } from "./StoragePanel";
import { TOOLS } from "../agents/tools";
import { saveProfile } from "../lib/profile";
import { collectProfileData } from "./ProfileSync";

const LOCAL_MODELS = [
  "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
  "Hermes-3-Llama-3.1-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC",
  "Hermes-2-Pro-Llama-3-8B-q4f32_1-MLC",
  "Hermes-2-Pro-Mistral-7B-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
];

const VENDOR_LABELS: Record<RemoteVendor, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  groq: "Groq",
};

const VENDOR_HINTS: Record<RemoteVendor, string> = {
  openai: "platform.openai.com → API keys (sk-...)",
  anthropic: "console.anthropic.com → API keys (sk-ant-...)",
  gemini: "aistudio.google.com → Get API key (AIza...)",
  openrouter: "openrouter.ai/keys (modelos grátis :free com chave grátis)",
  groq: "console.groq.com → keys (gsk_...)",
};

const VENDOR_URLS: Record<RemoteVendor, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

const KEYS_DEFAULTS: ApiKeys = { openai: "", anthropic: "", gemini: "", openrouter: "", groq: "" };

type Tab = "ai" | "repos" | "agent" | "account" | "diag";

const TABS: Array<{ id: Tab; label: string; icon: typeof KeyRound }> = [
  { id: "ai", label: "IA & Chaves", icon: KeyRound },
  { id: "repos", label: "Repositórios", icon: FolderGit2 },
  { id: "agent", label: "Agente", icon: Bot },
  { id: "account", label: "Conta & Sync", icon: Cloud },
  { id: "diag", label: "Diagnóstico", icon: Gauge },
];

function authLabel(src: string | null): string {
  if (src === "supabase") return "GitHub OAuth via Supabase";
  if (src === "device") return "GitHub OAuth (Device Flow)";
  if (src === "manual") return "token manual (teste)";
  return "—";
}

export function Dashboard() {
  const setShowDashboard = useAppStore((s) => s.setShowDashboard);
  const gitUsername = useAppStore((s) => s.gitUsername);
  const [tab, setTab] = useState<Tab>("ai");

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-surface-600 bg-surface-900 px-3 py-2">
        <button
          onClick={() => setShowDashboard(false)}
          className="flex min-h-11 items-center gap-2 text-slate-300 hover:text-white touch-manipulation"
          title="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden font-bold sm:inline">AICOLLIDER</span>
        </button>
        <span className="min-h-11 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Gauge className="h-4 w-4 text-sky-400" /> Dashboard de controle
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {gitUsername && (
            <>
              <Github className="h-3.5 w-3.5" />
              <span className="max-w-40 truncate">{gitUsername}</span>
            </>
          )}
        </span>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-surface-600 bg-surface-900/60 px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 min-h-10 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium touch-manipulation ${
              tab === t.id ? "bg-sky-600/20 text-sky-200" : "text-slate-400 hover:bg-surface-700 hover:text-slate-200"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {tab === "ai" && <AIKeysTab />}
          {tab === "repos" && <ReposTab />}
          {tab === "agent" && <AgentTab />}
          {tab === "account" && <AccountTab />}
          {tab === "diag" && <DiagnosticsTab />}
        </div>
      </main>
    </div>
  );
}

function AIKeysTab() {
  const { apiKeys, setApiKey, models, setModel, vendor, setVendor, localModel, setLocalModel, setToast } = useAppStore();
  const [keys, setKeys] = useState<ApiKeys>(() => ({ ...KEYS_DEFAULTS, ...apiKeys }));
  const [selModel, setSelModel] = useState(() => ({ ...DEFAULT_MODELS, ...models }));
  const [showKeys, setShowKeys] = useState(false);

  function saveKeys() {
    (Object.keys(keys) as Array<keyof typeof keys>).forEach((v) => setApiKey(v, keys[v].trim()));
    setToast("Chaves de IA salvas no navegador.");
  }

  function saveModelAll() {
    (Object.keys(selModel) as RemoteVendor[]).forEach((v) => setModel(v, selModel[v].trim()));
    setToast("Modelos salvos.");
  }

  const activeRemote = vendor !== "local" ? (vendor as RemoteVendor) : null;

  return (
    <>
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
          <Sparkles className="h-4 w-4" /> Recomendado (default)
        </h2>
        <p className="text-sm text-emerald-100/80">
          O modelo padrão é o <b>DeepSeek V3.1 (free)</b> no OpenRouter — grátis, com tool calling e ótimo para o Modo
          Agente. Basta gerar uma chave grátis em <span className="text-emerald-300">openrouter.ai/keys</span>. Se preferir
          outra IA, escolha abaixo que o agente já usa os mesmos ajustes.
        </p>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <KeyRound className="h-4 w-4 text-emerald-400" /> Provedor padrão do chat
        </h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <button
            onClick={() => setVendor("local")}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium touch-manipulation ${
              vendor === "local" ? "border-amber-400 bg-amber-500/10 text-amber-200" : "border-surface-600 bg-surface-900 text-slate-300 hover:border-slate-500"
            }`}
          >
            <span className="block font-semibold">Local (WebGPU)</span>
            <span className="block text-[11px] text-slate-500">grátis · sem chave</span>
          </button>
          {(Object.keys(VENDOR_LABELS) as RemoteVendor[]).map((v) => (
            <button
              key={v}
              onClick={() => setVendor(v)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium touch-manipulation ${
                vendor === v ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-surface-600 bg-surface-900 text-slate-300 hover:border-slate-500"
              }`}
            >
              <span className="block font-semibold">{VENDOR_LABELS[v]}</span>
              <span className="block truncate text-[11px] text-slate-500">{apiKeys[v] ? "chave OK" : "sem chave"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-emerald-400" /> Chaves de IA (BYOK)
          </h3>
          <button
            onClick={() => setShowKeys((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-surface-900 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 touch-manipulation"
          >
            {showKeys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showKeys ? "ocultar" : "mostrar"}
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">Guardadas no seu navegador. Para levar para outro dispositivo, ative a sincronização na aba Conta & Sync.</p>
        <div className="space-y-2">
          {(Object.keys(VENDOR_LABELS) as RemoteVendor[]).map((v) => (
            <Field key={v} label={`${VENDOR_LABELS[v]} — API Key`}>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  type={showKeys ? "text" : "password"}
                  value={keys[v]}
                  onChange={(e) => setKeys((k) => ({ ...k, [v]: e.target.value }))}
                  placeholder={VENDOR_HINTS[v]}
                />
                <button
                  type="button"
                  onClick={() => setVendor(v)}
                  disabled={!(keys[v] ?? "").trim()}
                  className="shrink-0 rounded-xl border border-surface-600 px-3 text-xs text-slate-400 hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40 touch-manipulation"
                >
                  usar
                </button>
              </div>
            </Field>
          ))}
        </div>
        <Button variant="success" onClick={saveKeys} className="mt-3">
          Salvar chaves
        </Button>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Cpu className="h-4 w-4 text-amber-400" /> Modelos
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Modelo por provedor. O <b>Local</b> é baixado para o cache do navegador (WebGPU).
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {activeRemote ? (
            <Field label={`Modelo ${VENDOR_LABELS[activeRemote]}`}>
              <input
                className={inputCls}
                value={selModel[activeRemote]}
                onChange={(e) => setSelModel((m) => ({ ...m, [activeRemote]: e.target.value }))}
                placeholder={DEFAULT_MODELS[activeRemote]}
              />
            </Field>
          ) : (
            <Field label="Modelo WebLLM">
              <select className={inputCls} value={localModel} onChange={(e) => setLocalModel(e.target.value)}>
                {(LOCAL_MODELS.includes(localModel) ? LOCAL_MODELS : [localModel, ...LOCAL_MODELS]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">Hermes 3 usa tools nativos; Hermes 2 e os leves (Qwen/Llama) usam tool calling manual.</span>
            </Field>
          )}
          <Field label="Endpoint usado">
            <input className={inputCls} readOnly value={activeRemote ? VENDOR_URLS[activeRemote] : "WebLLM (100% no navegador)"} />
          </Field>
        </div>
        <Button variant="secondary" onClick={saveModelAll} className="mt-3">
          Salvar modelos
        </Button>
      </section>
    </>
  );
}

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
    return `${Math.floor(h / 24)}d`;
  } catch {
    return "";
  }
}

function ReposTab() {
  const { gitToken, gitUsername, setActiveRepo, setRepositoryUrl, setTree, setSelectedPath, setContents, setShowSyncModal, setShowDashboard, setToast, setStorage, setGitToken } = useAppStore();
  const [dirs, setDirs] = useState<Array<{ name: string; size: number }>>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number; phase: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ghRepos, setGhRepos] = useState<GitHubRepo[] | null>(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghQuery, setGhQuery] = useState("");

  const loadDirs = useCallback(async () => {
    const info = await refreshStorageInfo(false);
    setStorage(info);
    const names = (await listTopLevelDirs()).filter((n) => !n.startsWith("_"));
    const sized = await Promise.all(names.map(async (n) => ({ name: n, size: await calcDirSize(n).catch(() => 0) })));
    setDirs(sized.sort((a, b) => b.size - a.size));
  }, [setStorage]);

  useEffect(() => {
    void loadDirs();
  }, [loadDirs]);

  const fetchRepos = useCallback(async () => {
    if (!gitToken) {
      setGhRepos(null);
      setGhError(null);
      return;
    }
    setGhLoading(true);
    setGhError(null);
    try {
      const all: GitHubRepo[] = [];
      for (let page = 1; page <= 10; page++) {
        const res = await fetch(
          `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
          { headers: { Authorization: `Bearer ${gitToken}`, Accept: "application/vnd.github+json", "User-Agent": "aicollider" } }
        );
        if (!res.ok) {
          setGhError(res.status === 401 || res.status === 403 ? "Sessão GitHub não autorizada (token inválido ou sem escopo 'repo')." : `Falha ao buscar repositórios (HTTP ${res.status}).`);
          setGhRepos(all);
          setGhLoading(false);
          return;
        }
        const list = (await res.json()) as GitHubRepo[];
        all.push(...list);
        if (list.length < 100) break;
      }
      setGhRepos(all);
    } catch (e) {
      setGhError(e instanceof Error ? e.message : "Falha ao buscar repositórios do GitHub.");
    } finally {
      setGhLoading(false);
    }
  }, [gitToken]);

  useEffect(() => {
    void fetchRepos();
  }, [fetchRepos]);

  async function openRepo(dir: string, repoUrl?: string | null) {
    const meta = await loadRepoMeta(dir);
    const resUrl = repoUrl ?? meta?.repositoryUrl ?? null;
    setActiveRepo(dir);
    setRepositoryUrl(resUrl);
    void saveRepoMeta(dir, { repositoryUrl: resUrl });
    setTree([]);
    setSelectedPath(null);
    setContents("", "");
    setShowSyncModal(true);
    setShowDashboard(false);
  }

  async function handleClone(repoUrl: string) {
    if (!repoUrl.trim() || !gitToken) {
      setError(gitToken ? "Cole a URL do repositório." : "Entre com GitHub para clonar repositórios.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ loaded: 0, total: 0, phase: "iniciando" });
    try {
      const dir = repoUrl.replace(/\.git$/, "").split("/").pop() ?? "repositorio";
      await cloneRepo(repoUrl, dir, gitToken, (p) => setProgress({ loaded: p.loaded, total: p.total, phase: p.phase }));
      setToast(`Repositório "${dir}" clonado para o navegador.`);
      await loadDirs();
      await openRepo(dir, repoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no clone. Verifique o escopo 'repo' do token e a URL.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleOpenRepo(r: GitHubRepo) {
    setError(null);
    if (dirs.some((d) => d.name === r.name)) {
      await openRepo(r.name);
      return;
    }
    await handleClone(r.clone_url);
  }

  async function handleCreateLocal() {
    const raw = newName.trim();
    const slug = raw.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    if (!slug) {
      setError("Dê um nome ao projeto (ex.: minha-landing).");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createLocalProject(slug);
      await loadDirs();
      setToast(`Projeto local "${slug}" criado.`);
      await openRepo(slug, null);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar o projeto local.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(name: string) {
    setDeleting(name);
    try {
      await deletePath(`/${name}`);
      if (useAppStore.getState().activeRepo === name) setActiveRepo(null);
      await loadDirs();
      setToast(`Repositório local "${name}" removido.`);
    } catch (e) {
      setToast(`Erro ao excluir: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeleting(null);
    }
  }

  async function enterScratch() {
    const dirs = await listTopLevelDirs();
    if (!dirs.includes(SCRATCH_REPO)) await createLocalProject(SCRATCH_REPO);
    setActiveRepo(SCRATCH_REPO);
    setRepositoryUrl(null);
    setTree([]);
    setSelectedPath(null);
    setContents("", "");
    setShowSyncModal(false);
    setShowDashboard(false);
  }

  const progressPct = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;
  const clonedNames = new Set(dirs.map((d) => d.name));

  return (
    <>
      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <FolderGit2 className="h-4 w-4 text-emerald-400" /> Repositórios locais (IndexedDB)
          </h3>
          <button
            onClick={() => void enterScratch()}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 touch-manipulation"
            title="Abrir o editor sem projeto (rascunho que você salva quando quiser)"
          >
            <Plus className="h-3.5 w-3.5" /> Editor em branco
          </button>
        </div>
        {dirs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum repositório clonado ainda. Clone ou crie abaixo.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dirs.map((d) => (
              <li key={d.name} className="flex items-center gap-2 rounded-xl border border-surface-600 bg-surface-900 p-2 pl-3">
                <button onClick={() => void openRepo(d.name)} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-left text-sm font-mono text-slate-100 hover:text-sky-300 touch-manipulation" title="Abrir">
                  <FolderGit2 className="h-4 w-4 shrink-0 text-sky-400" />
                  <span className="truncate">{d.name}</span>
                </button>
                <span className="shrink-0 text-[11px] text-slate-500">{prettyBytes(d.size)}</span>
                <button
                  onClick={() => void handleDelete(d.name)}
                  disabled={deleting === d.name}
                  className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 touch-manipulation"
                  title="Excluir local"
                >
                  {deleting === d.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Download className="h-4 w-4 text-sky-400" /> Clonar por URL
        </h3>
        <Field label="URL do repositório GitHub" hint="Ex.: https://github.com/usuario/meu-projeto.git">
          <input
            className={inputCls}
            placeholder="https://github.com/usuario/meu-repo.git"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && void handleClone(url)}
          />
        </Field>
        <Button onClick={() => void handleClone(url)} disabled={busy || !url.trim()} className="mt-3 w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? "Clonando..." : "Clonar para o navegador"}
        </Button>
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
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Plus className="h-4 w-4 text-emerald-400" /> Novo projeto local
        </h3>
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
            Criar
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Github className="h-4 w-4 text-emerald-400" /> Seus repositórios no GitHub
            {ghRepos && ghRepos.length > 0 && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{ghRepos.length}</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {gitUsername && <span className="text-[11px] text-slate-500">@{gitUsername}</span>}
            <button onClick={() => void fetchRepos()} className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-100 touch-manipulation" title="Recarregar">
              <RefreshCw className={`h-4 w-4 ${ghLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {ghError && (
          <div className="mb-3 space-y-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
            <p>{ghError}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void fetchRepos()} className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/30 touch-manipulation">
                Tentar novamente
              </button>
              <button
                onClick={() => setGitToken(null, null, null, null)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-700/60 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 touch-manipulation"
              >
                <LogOut className="h-3.5 w-3.5" /> Trocar de conta
              </button>
            </div>
          </div>
        )}

        {ghLoading && !ghRepos ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-surface-800/80" />
            ))}
          </div>
        ) : ghRepos && ghRepos.length === 0 ? (
          !ghError && <p className="text-sm text-slate-500">Nenhum repositório encontrado nesta conta.</p>
        ) : ghRepos ? (
          <>
            {ghRepos.length > 8 && (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className={`${inputCls} pl-9`} placeholder={`Filtrar ${ghRepos.length} repositórios...`} value={ghQuery} onChange={(e) => setGhQuery(e.target.value)} />
              </div>
            )}
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {ghRepos
                .filter((r) => !ghQuery.trim() || `${r.name} ${r.full_name} ${r.description ?? ""}`.toLowerCase().includes(ghQuery.trim().toLowerCase()))
                .map((r) => (
                  <li key={r.id ?? r.full_name}>
                    <button
                      onClick={() => void handleOpenRepo(r)}
                      disabled={busy}
                      className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-surface-600 bg-surface-900 px-3 py-2 text-left hover:border-emerald-500 disabled:opacity-50 touch-manipulation"
                    >
                      <FolderGit2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-slate-100">
                          {r.name} {r.private ? <Lock className="mb-0.5 inline h-3 w-3 text-amber-400" /> : <Globe className="mb-0.5 inline h-3 w-3 text-slate-500" />}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{r.description ?? r.full_name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">{clonedNames.has(r.name) ? "abrir" : timeAgo(r.updated_at)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        ) : null}
      </section>

      {error && <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
    </>
  );
}

function AgentTab() {
  const { agentConfig, setAgentConfig, setToast, activeRepo, autonomyByRepo, setAutonomy } = useAppStore();
  const [temperature, setTemperature] = useState(agentConfig.temperature);
  const [maxSteps, setMaxSteps] = useState(agentConfig.maxSteps);

  function save() {
    setAgentConfig({
      temperature: Math.min(2, Math.max(0, Number(temperature) || DEFAULT_AGENT_CONFIG.temperature)),
      maxSteps: Math.min(40, Math.max(1, Math.round(Number(maxSteps) || DEFAULT_AGENT_CONFIG.maxSteps))),
    });
    setToast("Parâmetros do agente salvos.");
  }

  return (
    <>
      <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
        <p className="text-sm text-emerald-100/80">
          <b>Zero-config:</b> conectou uma chave (OpenRouter, Groq...) ou ativou WebGPU local? O Modo Agente já funciona
          com estes padrões. Ajuste aqui se quiser outro comportamento.
        </p>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Bot className="h-4 w-4 text-sky-400" /> Comportamento do agente
        </h3>

        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium text-slate-200">Modo único (conversa + agente)</span>
          <p className="text-xs text-slate-400">
            Não existe mais modo "Conversar" separado: você conversa com a IA no chat e, quando pede uma tarefa, ela
            planeja e propõe mudanças (diffs) que você aprova. Chame um especialista com <b>@nome</b> (ex.:{" "}
            <b>@security</b>) — a equipe é acionada automaticamente quando necessário.
          </p>
        </div>

        {activeRepo && (
          <div className="mb-4 rounded-xl border border-surface-700 bg-surface-900/60 px-3 py-2">
            <span className="mb-2 block min-w-0 truncate text-sm font-medium text-slate-200">
              Autonomia em "{activeRepo}"
            </span>
            <AutonomyPicker repo={activeRepo} />
            <p className="mt-1 text-xs text-slate-400">{AUTONOMY_HINTS[autonomyByRepo[activeRepo] ?? "proposed"]}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Temperatura (criatividade/aleatoriedade)" hint="0 = determinístico · 1+ = criativo. Recomendado: 0.3">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </Field>
          <Field label="Máx. iterações por tarefa" hint="Limite de chamadas de tools antes de encerrar. Recomendado: 14">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={40}
              step={1}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
            />
          </Field>
        </div>

        <details className="mt-4 group" open>
          <summary className="flex w-full cursor-pointer items-center justify-between py-1 text-xs font-semibold uppercase text-slate-400 touch-manipulation">
            <span>Tools disponíveis para o agente</span>
            <span className="text-[11px] normal-case">{""}</span>
          </summary>
          <ul className="mt-2 space-y-1.5">
            {TOOLS.map((t) => (
              <li key={t.function.name} className="rounded-lg border border-surface-600 bg-surface-900/60 px-3 py-2">
                <p className="font-mono text-xs text-sky-300">{t.function.name}</p>
                <p className="text-xs text-slate-400">{t.function.description}</p>
              </li>
            ))}
          </ul>
        </details>

        <p className="mt-4 flex items-start gap-1.5 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Cada mudança de arquivo continua exigindo o seu clique (Aceitar/Rejeitar) no diff — o agente nunca salva sozinho.
        </p>

        <Button variant="success" onClick={save} className="mt-3">
          Salvar parâmetros do agente
        </Button>
      </section>

      <AgentsPanel />
    </>
  );
}

function AccountTab() {
  const { gitToken, gitUsername, authSource, setGitToken, setActiveRepo, setToast, setShowDashboard, syncApiKeys, setSyncApiKeys, profileLastSync, setProfileLastSync, supabaseConfig, setSupabaseConfig } = useAppStore();
  const [url, setUrl] = useState(supabaseConfig.url);
  const [anonKey, setAnonKey] = useState(supabaseConfig.anonKey);
  const [syncing, setSyncing] = useState(false);

  async function handleSignOut() {
    await signOut();
    setActiveRepo(null);
    setShowDashboard(false);
    setToast("Sessão encerrada.");
  }

  async function syncNow() {
    if (!gitToken || !gitUsername) return;
    setSyncing(true);
    try {
      await saveProfile(gitToken, gitUsername, collectProfileData());
      setProfileLastSync(new Date().toLocaleTimeString());
      setToast("Perfil sincronizado.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Falha ao sincronizar o perfil.");
    } finally {
      setSyncing(false);
    }
  }

  function saveSupabase() {
    if (url.trim() && anonKey.trim()) {
      setSupabaseConfig({ url: url.trim(), anonKey: anonKey.trim() });
      setToast("Credenciais do Supabase salvas.");
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Github className="h-4 w-4 text-emerald-400" /> Conta GitHub
        </h3>
        <div className="rounded-xl border border-surface-600 bg-surface-900 p-3">
          <p className="text-sm text-slate-200">
            <b>{gitUsername ?? "Não logado"}</b>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Login: {authLabel(authSource)}
            {gitToken ? ` · token ativo em memória: ${gitToken.slice(0, 12)}…${gitToken.slice(-4)}` : ""} (nunca é persistido).
          </p>
        </div>
        <Button variant="danger" onClick={() => void handleSignOut()} className="mt-3">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Cloud className="h-4 w-4 text-sky-400" /> Perfil na nuvem (segue você entre dispositivos)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          O app salva um <code className="rounded bg-surface-900 px-1">profile.json</code> num repositório privado{" "}
          <code className="rounded bg-surface-900 px-1">aicollider-profile</code> seu. Provedor, modelos, config do agente e
          últimos repositórios são restaurados no próximo login.
        </p>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-600 bg-surface-900/60 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-300 touch-manipulation">
            <input type="checkbox" checked={syncApiKeys} onChange={(e) => setSyncApiKeys(e.target.checked)} className="h-4 w-4 accent-emerald-500" />
            Sincronizar chaves de IA no perfil
          </label>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            {gitUsername ? `perfil: ${gitUsername}` : "entre para ativar"}
          </span>
          {profileLastSync && <span className="text-[11px] text-slate-500">última sincronização: {profileLastSync}</span>}
        </div>
        <p className="mt-2 text-xs text-amber-300/90">
          As chaves ficam em texto plano num repo privado seu — por isso a sincronização delas vem desligada por padrão.
        </p>
        <Button variant="secondary" onClick={() => void syncNow()} disabled={!gitToken || syncing} className="mt-3">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar agora
        </Button>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Cloud className="h-4 w-4 text-sky-400" /> Supabase (banco opcional)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Não é usado para login (o app autentica com GitHub). O Supabase entra apenas se você quiser um banco Postgres no projeto.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Supabase URL">
            <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </Field>
          <Field label="Anon Key">
            <input className={inputCls} value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGci..." />
          </Field>
        </div>
        <Button variant="secondary" onClick={saveSupabase} className="mt-3">
          Salvar Supabase
        </Button>
      </section>
    </>
  );
}

function DiagnosticsTab() {
  const { vendor, localModel, localProgress } = useAppStore();
  const [gpu, setGpu] = useState<boolean | null>(null);

  useEffect(() => {
    setGpu(!!(typeof navigator !== "undefined" && navigator.gpu));
  }, []);

  return (
    <>
      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <HardDrive className="h-4 w-4 text-sky-400" /> WebGPU & IA local
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-surface-600 bg-surface-900 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">WebGPU (navegador)</p>
            <p className={`mt-1 flex items-center gap-1.5 text-sm ${gpu ? "text-emerald-300" : "text-amber-300"}`}>
              {gpu ? (
                <>
                  <Check className="h-4 w-4" /> Disponível
                </>
              ) : gpu === false ? (
                <>
                  <AlertTriangle className="h-4 w-4" /> Indisponível — use Chrome/Edge recente
                </>
              ) : (
                "verificando..."
              )}
            </p>
          </div>
          <div className="rounded-xl border border-surface-600 bg-surface-900 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Provedor / modelo</p>
            <p className="mt-1 text-sm text-slate-200">{vendor === "local" ? `Local: ${localModel}` : `Remoto: ${vendor}`}</p>
            {localProgress.text && <p className="text-xs text-sky-300">{localProgress.text}</p>}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Status fase 2 (roadmap): o modelo local baixa mas pode não concluir o uso — colocamos o diagnóstico aqui para acompanharmos juntos.
        </p>
      </section>

      <section className="rounded-2xl border border-surface-600 bg-surface-800 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
          <HardDrive className="h-4 w-4 text-sky-400" /> Armazenamento & cache
        </h3>
        <StoragePanel />
      </section>
    </>
  );
}

function Check({ className }: { className?: string }) {
  return <span className={className}>✓</span>;
}