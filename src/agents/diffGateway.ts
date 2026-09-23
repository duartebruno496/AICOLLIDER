import type { PendingChange } from "../types";
import { useAppStore } from "../store/useAppStore";

type Resolver = (ok: boolean) => void;

interface QueueEntry {
  change: PendingChange;
  resolve: Resolver;
}

let queue: QueueEntry[] = [];

function sync() {
  useAppStore.getState().setPendingChanges(queue.map((e) => e.change));
}

export function hasPendingApproval(): boolean {
  return useAppStore.getState().pendingChanges.length > 0;
}

/**
 * Enfileira um diff para aprovação humana (fila única FIFO).
 * O humano decide os diffs na ordem de chegada; esta Promise só resolve
 * quando o diff for o da frente E for decidido (Aceitar/Rejeitar).
 */
export function waitForApproval(change: Omit<PendingChange, "fromAgent" | "from">, from = "Agente"): Promise<boolean> {
  const full: PendingChange = { ...change, fromAgent: true, from };
  return new Promise<boolean>((resolve) => {
    queue.push({ change: full, resolve });
    sync();
  });
}

/** Decide o diff da frente da fila. Retorna false se não havia nada pendente. */
export function settlePendingChange(ok: boolean): boolean {
  if (queue.length === 0) return false;
  const [head] = queue.splice(0, 1);
  sync();
  head.resolve(ok);
  return true;
}