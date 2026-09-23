import type { AgentConfig, ChatMode, RemoteVendor } from "../types";

export const PROFILE_REPO = "aicollider-profile";
export const PROFILE_FILE = "profile.json";

export interface ProfileData {
  appVersion: number;
  supabaseConfig: { url: string; anonKey: string };
  vendor: string;
  apiKeys: Partial<Record<string, string>>;
  models: Partial<Record<RemoteVendor, string>>;
  localModel: string;
  /** Legacy: perfis antigos traziam agentEnabled (default true). Hoje usamos chatMode. */
  agentEnabled?: boolean;
  chatMode?: ChatMode;
  agentConfig?: AgentConfig;
  syncApiKeys: boolean;
  activeRepo: string | null;
  repositoryUrl: string | null;
  repoDirs: string[];
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "aicollider-profile",
  };
}

async function whoami(token: string): Promise<string> {
  const res = await fetch("https://api.github.com/user", { headers: headers(token) });
  if (!res.ok) throw new Error(`Token inválido (HTTP ${res.status})`);
  const json = (await res.json()) as { login: string };
  return json.login;
}

async function getOrCreateRepo(token: string, owner: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${PROFILE_REPO}`, { headers: headers(token) });
  if (res.status === 200) return;
  if (res.status !== 404) throw new Error(`Erro ao acessar perfil (HTTP ${res.status})`);
  const create = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ name: PROFILE_REPO, description: "Perfil AICOLLIDER (criado automaticamente)", private: true }),
  });
  if (!create.ok) {
    const t = await create.text().catch(() => "");
    throw new Error(`Não foi possível criar o repositório do perfil: ${t.slice(0, 200)}`);
  }
}

async function readProfileFile(token: string, owner: string): Promise<ProfileData | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${PROFILE_REPO}/contents/${PROFILE_FILE}`, {
    headers: headers(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erro ao ler perfil (HTTP ${res.status})`);
  const json = (await res.json()) as { content: string; sha: string };
  const text = decodeBase64(json.content.replace(/\s+/g, ""));
  try {
    return JSON.parse(text) as ProfileData;
  } catch {
    return null;
  }
}

function encodeBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function decodeBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function loadProfile(token: string): Promise<{ owner: string; profile: ProfileData | null }> {
  const owner = await whoami(token);
  await getOrCreateRepo(token, owner);
  const profile = await readProfileFile(token, owner);
  return { owner, profile };
}

export async function saveProfile(token: string, owner: string, data: ProfileData): Promise<void> {
  const repoOk = await fetch(`https://api.github.com/repos/${owner}/${PROFILE_REPO}`, { headers: headers(token) });
  if (repoOk.status === 404) await getOrCreateRepo(token, owner);

  const existing = await readProfileFile(token, owner);
  const content = encodeBase64(JSON.stringify(data, null, 2));
  const body: Record<string, string> = {
    message: "Atualiza perfil AICOLLIDER",
    content,
  };
  if (existing !== null) {
    const meta = await fetch(`https://api.github.com/repos/${owner}/${PROFILE_REPO}/contents/${PROFILE_FILE}`, {
      headers: headers(token),
    });
    if (meta.ok) {
      const sha = ((await meta.json()) as { sha: string }).sha;
      if (sha) body.sha = sha;
    }
  }
  const put = await fetch(`https://api.github.com/repos/${owner}/${PROFILE_REPO}/contents/${PROFILE_FILE}`, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!put.ok) {
    const t = await put.text().catch(() => "");
    throw new Error(`Falha ao salvar perfil: ${t.slice(0, 200)}`);
  }
}