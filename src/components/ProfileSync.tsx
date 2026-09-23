import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { localModelSupportsTools } from "../lib/llm/providers/local";
import type { ApiKeys, RemoteVendor } from "../types";
import { DEFAULT_MODELS } from "../types";
import { loadProfile, saveProfile, type ProfileData } from "../lib/profile";

const VALID_VENDORS = Object.keys(DEFAULT_MODELS);

function collect(): ProfileData {
  const s = useAppStore.getState();
  return {
    appVersion: 1,
    supabaseConfig: s.supabaseConfig,
    vendor: s.vendor,
    apiKeys: s.syncApiKeys ? { ...s.apiKeys } : {},
    models: s.models,
    localModel: s.localModel,
    agentEnabled: s.agentEnabled,
    syncApiKeys: s.syncApiKeys,
    activeRepo: s.activeRepo,
    repositoryUrl: s.repositoryUrl,
    repoDirs: s.repoDirs,
  };
}

function mergeProfile(p: ProfileData): void {
  const s = useAppStore.getState();
  if (p.vendor && VALID_VENDORS.includes(p.vendor)) s.setVendor(p.vendor as never);
  if (p.supabaseConfig?.url) s.setSupabaseConfig(p.supabaseConfig);
  if (p.localModel && localModelSupportsTools(p.localModel)) s.setLocalModel(p.localModel);
  if (typeof p.agentEnabled === "boolean") s.setAgentEnabled(p.agentEnabled);
  if (p.agentConfig && Number.isFinite(p.agentConfig.temperature) && Number.isFinite(p.agentConfig.maxSteps)) {
    s.setAgentConfig({
      temperature: Math.min(2, Math.max(0, p.agentConfig.temperature)),
      maxSteps: Math.min(40, Math.max(1, Math.round(p.agentConfig.maxSteps))),
    });
  }
  if (typeof p.syncApiKeys === "boolean") s.setSyncApiKeys(p.syncApiKeys);
  if (p.models) {
    (Object.keys(p.models) as RemoteVendor[]).forEach((v) => {
      const m = p.models[v];
      if (m) s.setModel(v, m);
    });
  }
  if (p.syncApiKeys && p.apiKeys) {
    (Object.keys(p.apiKeys) as Array<keyof ApiKeys>).forEach((v) => {
      const k = p.apiKeys[v];
      if (k) s.setApiKey(v, k);
    });
  }
  if (Array.isArray(p.repoDirs)) s.setRepoDirs(p.repoDirs);
  if (p.activeRepo) s.setActiveRepo(p.activeRepo);
  if (p.repositoryUrl) s.setRepositoryUrl(p.repositoryUrl);
  s.setProfileLastSync(new Date().toLocaleTimeString());
}

function persistedSnapshot(s: ReturnType<typeof useAppStore.getState>): string {
  return JSON.stringify({
    supabaseConfig: s.supabaseConfig,
    vendor: s.vendor,
    apiKeys: s.syncApiKeys ? { ...s.apiKeys } : {},
    models: s.models,
    localModel: s.localModel,
    agentEnabled: s.agentEnabled,
    agentConfig: s.agentConfig,
    syncApiKeys: s.syncApiKeys,
    activeRepo: s.activeRepo,
    repositoryUrl: s.repositoryUrl,
    repoDirs: s.repoDirs,
  });
}

/** Coleta o snapshot atual do perfil (reutilizado pelo Dashboard para "Sincronizar agora"). */
export function collectProfileData(): ProfileData {
  return collect();
}

/** Sincroniza o perfil do usuário com um repo privado no GitHub (serverless). */
export function ProfileSync() {
  const gitToken = useAppStore((s) => s.gitToken);
  const gitUsername = useAppStore((s) => s.gitUsername);
  const loadedFor = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!gitToken || !gitUsername || loadedFor.current === gitToken) return;
    loadedFor.current = gitToken;
    void (async () => {
      try {
        const { profile } = await loadProfile(gitToken);
        if (profile) {
          mergeProfile(profile);
        } else {
          await saveProfile(gitToken, gitUsername, collect());
          useAppStore.getState().setProfileLastSync(new Date().toLocaleTimeString());
        }
      } catch (e) {
        useAppStore.getState().setToast(e instanceof Error ? e.message : "Falha ao carregar o perfil.");
        loadedFor.current = null;
      }
    })();
  }, [gitToken, gitUsername]);

  useEffect(() => {
    if (!gitToken || !gitUsername) return;
    const unsub = useAppStore.subscribe((s, prev) => {
      if (persistedSnapshot(s) === persistedSnapshot(prev)) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void saveProfile(gitToken, gitUsername, collect())
          .then(() => useAppStore.getState().setProfileLastSync(new Date().toLocaleTimeString()))
          .catch(() => {
            /* falha pontual de rede: tenta no próximo snapshot */
          });
      }, 1200);
    });
    return () => {
      unsub();
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [gitToken, gitUsername]);

  return null;
}