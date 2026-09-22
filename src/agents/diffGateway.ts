import type { PendingChange } from "../types";
import { useAppStore } from "../store/useAppStore";

type Resolver = (ok: boolean) => void;

let currentResolver: Resolver | null = null;

export function hasPendingApproval(): boolean {
  return useAppStore.getState().pendingChange !== null;
}

/**
 * Abre o DiffViewer com a mudança proposta e retorna uma Promise
 * que só resolve quando o humano clicar em "Aceitar" ou "Rejeitar".
 */
export function waitForApproval(change: Omit<PendingChange, "fromAgent">): Promise<boolean> {
  if (currentResolver) {
    currentResolver(false);
    currentResolver = null;
  }
  useAppStore.getState().setPendingChange({ ...change, fromAgent: true });
  return new Promise<boolean>((resolve) => {
    currentResolver = resolve;
  });
}

export function settlePendingChange(ok: boolean): boolean {
  if (!currentResolver) return false;
  const r = currentResolver;
  currentResolver = null;
  useAppStore.getState().setPendingChange(null);
  r(ok);
  return true;
}