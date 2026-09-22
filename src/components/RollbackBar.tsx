import { useState } from "react";
import { Undo2, GitCommitHorizontal } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { undoLastCommit, logRepo } from "../lib/git";
import { refreshWorkspace } from "../lib/workspace";
import { Modal, Button } from "./common";

export function RollbackBar({ repo }: { repo: string }) {
  const { setToast, setEditorMode, setContents, setSelectedPath } = useAppStore();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastCommitMsg, setLastCommitMsg] = useState("");

  async function openConfirm() {
    try {
      const logs = await logRepo(repo);
      if (logs.length < 2) {
        setToast("Não há commits anteriores para desfazer.");
        return;
      }
      setLastCommitMsg(logs[0].commit.message);
      setConfirm(true);
    } catch {
      setToast("Não foi possível ler o histórico de commits.");
    }
  }

  async function doRollback() {
    setBusy(true);
    try {
      await undoLastCommit(repo);
      setConfirm(false);
      setSelectedPath(null);
      setContents("", "");
      setEditorMode("code");
      await refreshWorkspace(repo);
      setToast("Última alteração desfeita (git reset --hard HEAD~1).");
    } catch (e) {
      setToast(`Rollback falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="border-t border-surface-600 bg-surface-900 px-3 py-1.5">
        <button
          onClick={() => void openConfirm()}
          className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-surface-700 hover:text-slate-200 touch-manipulation"
          title="Equivalente a git reset --hard HEAD~1 no repositório virtual"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Desfazer última alteração
        </button>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Confirmar rollback">
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-slate-300">
            <GitCommitHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            Isso executa <code className="rounded bg-surface-900 px-1.5 py-0.5 font-mono text-xs">git reset --hard HEAD~1</code>,
            descartando o commit local <em className="text-rose-300">"{lastCommitMsg.slice(0, 60)}"</em> e todas as mudanças não commitadas.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => void doRollback()} disabled={busy} className="flex-1">
              {busy ? "Desfazendo..." : "Sim, desfazer"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}