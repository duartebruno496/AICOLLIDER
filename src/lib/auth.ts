import { getSupabase, extractSessionPayload } from "./supabase";
import { useAppStore, type SupabaseConfig } from "../store/useAppStore";

function applySession(cfg: SupabaseConfig) {
  const sb = getSupabase(cfg.url, cfg.anonKey);
  if (!sb) return () => {};
  let disposed = false;

  const handle = async () => {
    if (disposed) return;
    const { data } = await sb.auth.getSession();
    const payload = extractSessionPayload(data.session);
    if (payload.token) {
      useAppStore.getState().setGitToken(payload.token, payload.name, payload.avatar, "supabase");
      console.info("[AICOLLIDER] provider_token (GitHub Access Token) capturado:", payload.token.slice(0, 16) + "…");
    } else if (data.session && !payload.token) {
      // sessão existe, mas sem provider_token
      useAppStore.getState().setGitToken(null, payload.name, payload.avatar, "supabase");
      console.warn("[AICOLLIDER] Sessão GitHub detectada, porém sem provider_token no payload.");
    }
  };

  void handle();
  const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
    const payload = extractSessionPayload(session);
    if (payload.token) {
      useAppStore.getState().setGitToken(payload.token, payload.name, payload.avatar, "supabase");
      console.info("[AICOLLIDER] provider_token atualizado via onAuthStateChange:", payload.token.slice(0, 16) + "…");
    } else if (!session) {
      useAppStore.getState().setGitToken(null, null, null, null);
    }
  });

  return () => {
    disposed = true;
    sub.subscription.unsubscribe();
  };
}

export function initAuth(cfg: SupabaseConfig): () => void {
  return applySession(cfg);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  await sb?.auth.signOut().catch(() => undefined);
  useAppStore.getState().setGitToken(null, null, null);
}