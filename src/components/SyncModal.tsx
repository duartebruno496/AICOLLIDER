import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, GitCompare } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { detectSyncState, pullBranch, getRemoteHeadRefs, resolveLocalHead, getAheadBehind } from "../lib/git";
import { Modal, Button } from "./common";
import { refreshWorkspace } from "../lib/workspace";

export function SyncModal({ repo, onAfterSync }: { repo: string; onAfterSync?: () => void }) {
  const { showSyncModal, setShowSyncModal, gitToken, setToast, setSyncInfo, syncInfo } = useAppStore();
  const [local, setLocal] = useState<string | undefined>();
  const [remote, setRemote] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (showSyncModal && repo) {
      void runCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSyncModal, repo]);

  async function runCheck() {
    setBusy(true);
    try {
      const [status, lh, rhRefs, counts] = await Promise.all([
        detectSyncState(repo),
        resolveLocalHead(repo),
        getRemoteHeadRefs(repo),
        getAheadBehind(repo).catch(() => ({ ahead: 0, behind: 0 })),
      ]);
      setLocal(lh);
      const firstRemote = Object.entries(rhRefs)[0]?.[1];
      setRemote(firstRemote);
      setSyncInfo({ status, localHash: lh, remoteHash: firstRemote, aheadCount: counts.ahead, behindCount: counts.behind });
      setChecked(true);
    } catch {
      setSyncInfo({ status: "unknown" });
      setChecked(true);
    } finally {
      setBusy(false);
    }
  }

  async function doPull() {
    if (!gitToken) {
      setToast("Sem token GitHub para autenticar o pull.");
      return;
    }
    setBusy(true);
    try {
      await pullBranch(repo, gitToken);
      setToast("Sincronizado! Fast-forward concluído.");
      await refreshWorkspace(repo);
      await runCheck();
      onAfterSync?.();
    } catch (e) {
      setToast(`Falha no pull: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setShowSyncModal(false);
    onAfterSync?.();
  }

  const needsSync = checked && syncInfo.status && syncInfo.status !== "in-sync" && syncInfo.status !== "unknown";

  return (
    <Modal open={showSyncModal} onClose={busy ? undefined : close} title="Sincronização do repositório">
      {!checked ? (
        <p className="text-sm text-slate-400">Verificando HEAD local vs branch remoto...</p>
      ) : (
        <div className="space-y-4">
          {syncInfo.status === "in-sync" && (
            <p className="flex items-center gap-2 text-sm text-emerald-300">
              <GitCompare className="h-4 w-4" /> Seu repositório local está em sincronia com o remoto. Pode codar.
            </p>
          )}
          {syncInfo.status === "unknown" && (
            <p className="flex items-center gap-2 text-sm text-slate-400">
              <GitCompare className="h-4 w-4" /> Não foi possível comparar (repositório sem histórico remoto ou sem rede).
            </p>
          )}

          {needsSync && (
            <>
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="flex items-start gap-2 text-sm text-amber-200">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  {syncInfo.status === "behind" && "O repositório remoto tem commits mais novos que o seu clone local. Recomendamos sincronizar (fast-forward) antes de codar."}
                  {syncInfo.status === "ahead" && "Você tem commits locais ainda não enviados. Eles não serão perdidos."}
                  {syncInfo.status === "diverged" && "Sua branch local e a remota divergiram. Sincronizar fará um merge; recusar pode gerar conflitos depois."}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
                  <div className="rounded-lg bg-surface-900 p-2">
                    <div className="text-slate-500">HEAD local</div>
                    <div className="truncate">{local ? local.slice(0, 10) : "—"}</div>
                  </div>
                  <div className="rounded-lg bg-surface-900 p-2">
                    <div className="text-slate-500">Remoto</div>
                    <div className="truncate">{remote ? remote.slice(0, 10) : "—"}</div>
                  </div>
                </div>
                <p className="mt-2 text-xs text-amber-200/70">
                  {syncInfo.behindCount != null && syncInfo.behindCount > 0 ? `${syncInfo.behindCount} commit(s) atrás` : ""}
                  {syncInfo.aheadCount != null && syncInfo.aheadCount > 0 ? ` · ${syncInfo.aheadCount} commit(s) à frente` : ""}
                  <span className="block mt-1">Se você recusar e fizer commits locais com base no HEAD antigo, seu trabalho pode entrar em conflito.</span>
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void doPull()} disabled={busy} className="flex-1">
                  <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Sincronizar agora (pull)
                </Button>
                <Button onClick={close} variant="ghost" disabled={busy}>
                  Continuar mesmo assim
                </Button>
              </div>
            </>
          )}

          {checked && !needsSync && (
            <div className="flex justify-end">
              <Button onClick={close}>Entendi</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}