import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function buildSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export function getSupabase(url?: string, anonKey?: string): SupabaseClient | null {
  const useUrl = url?.trim() || clientConfig.url;
  const useKey = anonKey?.trim() || clientConfig.anonKey;
  if (!useUrl || !useKey) return null;
  if (!client || clientConfig.url !== useUrl || clientConfig.anonKey !== useKey) {
    clientConfig.url = useUrl;
    clientConfig.anonKey = useKey;
    client = buildSupabaseClient(useUrl, useKey);
  }
  return client;
}

export const clientConfig = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "",
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
};

export async function signInWithGithub(redirectTo?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Configuração do Supabase ausente. Defina URL e Anon Key nas Configurações.");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: redirectTo ?? window.location.origin,
      scopes: "repo read:user",
    },
  });
  if (error) throw error;
}

/** Captura o provider_token (GitHub Access Token) retornado pelo Supabase. */
export function extractSessionPayload(session: Session | null) {
  if (!session) return { token: null, name: null, avatar: null };
  const token = (session.provider_token as string | undefined) ?? null;
  const meta = session.user?.user_metadata as Record<string, unknown> | undefined;
  return {
    token,
    name: (meta?.user_name as string | undefined) ?? session.user?.email ?? null,
    avatar: (meta?.avatar_url as string | undefined) ?? null,
  };
}