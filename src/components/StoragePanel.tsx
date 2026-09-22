import { useEffect, useState } from "react";
import { Trash2, HardDrive, AlertTriangle } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { listTopLevelDirs, deletePath } from "../lib/fs";
import { refreshStorageInfo, prettyBytes, calcDirSize } from "../lib/workspace";
import { Button } from "./common";

export function StoragePanel({ onDirRemoved }: { onDirRemoved?: () => void }) {
  const { setStorage, storage, setToast, setActiveRepo } = useAppStore();
  const [dirs, setDirs] = useState<Array<{ name: string; size: number }>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const info = await refreshStorageInfo(false);
    setStorage(info);
    const names = await listTopLevelDirs();
    const sized = await Promise.all(
      names.map(async (n) => ({ name: n, size: await calcDirSize(n).catch(() => 0) }))
    );
    setDirs(sized.sort((a, b) => b.size - a.size));
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, []);

  async function handleDelete(name: string) {
    setBusy(name);
    try {
      await deletePath(`/${name}`);
      if (useAppStore.getState().activeRepo === name) setActiveRepo(null);
      await load();
      onDirRemoved?.();
      setToast(`Repositório local "${name}" removido.`);
    } catch (e) {
      setToast(`Erro ao excluir: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  const quota = storage?.quotaBytes ?? 5 * 1024 * 1024 * 1024;
  const used = storage?.usageBytes ?? 0;
  const pct = storage?.usagePercent ?? 0;
  const warn = storage?.overWarning;
  const limit = storage?.overLimit;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-600 bg-surface-900 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-slate-200">
            <HardDrive className="h-4 w-4 text-sky-400" />
            Armazenamento do navegador
          </span>
          <span className="text-slate-400">
            {prettyBytes(used)} / {prettyBytes(quota)}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-700">
          <div
            className={`h-full rounded-full transition-all ${limit ? "bg-rose-500" : warn ? "bg-amber-400" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {(warn || limit) && (
          <p className="mt-2 flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {limit
              ? "Armazenamento no limite (5GB). Exclua repositórios locais antigos para liberar espaço."
              : "Atenção: ultrapassando 90% do limite de 5GB. Exclua caches de repositórios antigos abaixo."}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-300">Repositórios locais (lightning-fs)</h3>
        {dirs.length === 0 && <p className="text-sm text-slate-500">Nenhum repositório clonado ainda.</p>}
        <ul className="space-y-2">
          {dirs.map((d) => (
            <li key={d.name} className="flex items-center justify-between rounded-xl border border-surface-600 bg-surface-900/60 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm text-slate-100">{d.name}</p>
                <p className="text-xs text-slate-500">{prettyBytes(d.size)}</p>
              </div>
              <button
                onClick={() => void handleDelete(d.name)}
                disabled={busy === d.name}
                className="flex min-h-11 items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 touch-manipulation"
                title="Excluir repositório local"
              >
                <Trash2 className="h-4 w-4" />
                {busy === d.name ? "Excluindo..." : "Excluir"}
              </button>
            </li>
          ))}
        </ul>
        {dirs.length > 0 && (
          <p className="mt-2 text-xs text-slate-500">Excluir pasta local não apaga o repositório no GitHub.</p>
        )}
      </div>
      <Button variant="secondary" onClick={() => void load()}>
        Atualizar medição
      </Button>
    </div>
  );
}