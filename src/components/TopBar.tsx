import { Gauge, HardDrive, LogOut, ArrowLeft, RefreshCw } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { signOut } from "../lib/auth";

export function TopBar() {
  const { repositoryUrl, setActiveRepo, setShowStoragePanel, setShowDashboard, gitUsername, gitToken, authSource, syncInfo, setShowSyncModal, setToast } = useAppStore();

  const syncBadge: Record<string, { label: string; cls: string }> = {
    "in-sync": { label: "sincronizado", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40" },
    behind: { label: "atrás do remoto", cls: "bg-amber-500/10 text-amber-300 border-amber-500/40" },
    ahead: { label: "commits locais", cls: "bg-sky-500/10 text-sky-300 border-sky-500/40" },
    diverged: { label: "divergente", cls: "bg-rose-500/10 text-rose-300 border-rose-500/40" },
    unknown: { label: "sem remoto", cls: "bg-slate-500/10 text-slate-400 border-slate-500/40" },
  };

  async function handleSignOut() {
    await signOut();
    setActiveRepo(null);
    setToast("Sessão encerrada.");
  }

  return (
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-surface-600 bg-surface-900 px-3 py-2">
      <button onClick={() => setActiveRepo(null)} className="flex min-h-11 items-center gap-2 text-slate-300 hover:text-white touch-manipulation" title="Voltar para projetos">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden font-bold sm:inline">AICOLLIDER</span>
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate font-mono text-xs text-slate-300" title={repositoryUrl ?? ""}>
          {repositoryUrl?.replace(/^https:\/\//, "") ?? ""}
        </span>
        {syncInfo && syncInfo.status !== "unknown" && syncInfo.status !== undefined && (
          <button
            onClick={() => setShowSyncModal(true)}
            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${syncBadge[syncInfo.status]?.cls ?? syncBadge.unknown.cls}`}
          >
            <RefreshCw className="h-3 w-3" />
            {syncBadge[syncInfo.status]?.label ?? syncBadge.unknown.label}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {gitUsername && (
          <span
            className="hidden max-w-40 truncate text-xs text-slate-400 md:inline"
            title={
              gitToken
                ? `${
                    authSource === "supabase"
                      ? "OAuth via Supabase"
                      : authSource === "device"
                        ? "OAuth GitHub (Device Flow)"
                        : "token manual (teste)"
                  }: ${gitToken.slice(0, 24)}...`
                : "sem token"
            }
          >
            {gitUsername}
          </span>
        )}
        <button onClick={() => void handleSignOut()} className="flex min-h-11 items-center rounded-xl px-3 py-2 text-slate-300 hover:bg-surface-700 touch-manipulation" title="Sair">
          <LogOut className="h-4 w-4" />
        </button>
        <button onClick={() => setShowStoragePanel(true)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-surface-700 touch-manipulation" title="Armazenamento (lixeira)">
          <HardDrive className="h-4 w-4" />
          <span className="hidden sm:inline">Armazenamento</span>
        </button>
        <button onClick={() => setShowDashboard(true)} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-surface-700 touch-manipulation" title="Dashboard (IA, repositórios, agente, conta e diagnóstico)">
          <Gauge className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}