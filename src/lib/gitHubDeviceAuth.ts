/**
 * Login GitHub via OAuth Device Flow.
 *
 * O GitHub NÃO envia CORS nos endpoints de OAuth (github.com/login/*), então
 * as 2 chamadas necessárias passam por um relay opcional (Cloudflare Worker)
 * que apenas repassa e devolve com header CORS. Sem segredos: o device flow
 * do GitHub não exige client_secret.
 */

export interface DeviceCfg {
  clientId: string;
  relay: string; // ex.: https://aicollider-oauth-relay.sua-conta.workers.dev
}

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export const SCOPES = "repo read:user";

function pick<T extends DeviceCfg>(cfg: Partial<DeviceCfg> | undefined): DeviceCfg {
  if (cfg?.clientId && cfg?.relay) return { clientId: cfg.clientId.trim(), relay: cfg.relay.trim().replace(/\/$/, "") };
  throw new Error("Login GitHub não configurado ainda: ajuste as variáveis VITE_GITHUB_CLIENT_ID e VITE_GITHUB_DEVICE_RELAY (ou configure manualmente na tela de login).");
}

export function defaultDeviceCfg(): DeviceCfg | null {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined;
  const relay = import.meta.env.VITE_GITHUB_DEVICE_RELAY as string | undefined;
  if (clientId && relay) return { clientId: clientId.trim(), relay: relay.trim().replace(/\/$/, "") };
  return null;
}

async function relayPost(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error_description as string) ?? `Falha no login (${res.status}).`);
  return data;
}

export async function requestDeviceCode(cfg: DeviceCfg): Promise<DeviceCode> {
  const data = await relayPost(`${cfg.relay}/device/code`, { client_id: cfg.clientId, scope: SCOPES });
  return data as unknown as DeviceCode;
}

export type DevicePollResult =
  | { ok: true; accessToken: string; scope: string }
  | { ok: false; status: "authorization_pending" | "slow_down" | "expired" | "access_denied" | "error"; interval?: number };

export async function pollDeviceToken(cfg: DeviceCfg, deviceCode: string, interval: number): Promise<DevicePollResult> {
  const data = await relayPost(`${cfg.relay}/token`, {
    client_id: cfg.clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  if (data.access_token) {
    return { ok: true, accessToken: data.access_token as string, scope: (data.scope as string) ?? SCOPES };
  }
  switch (data.error) {
    case "authorization_pending":
      return { ok: false, status: "authorization_pending" };
    case "slow_down":
      return { ok: false, status: "slow_down", interval: (data.interval as number) ?? interval + 5 };
    case "expired_token":
      return { ok: false, status: "expired" };
    case "access_denied":
      return { ok: false, status: "access_denied" };
    default:
      return { ok: false, status: "error", interval };
  }
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

/** api.github.com tem CORS aberto (*) e aceita o token via Bearer. */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Falha ao buscar usuário do GitHub (${res.status}).`);
  return (await res.json()) as GitHubUser;
}