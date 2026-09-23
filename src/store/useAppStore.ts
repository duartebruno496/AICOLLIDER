import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ApiKeys,
  ChatMessage,
  LocalProgress,
  ModelVendor,
  PendingChange,
  RemoteVendor,
  StorageInfo,
  SyncInfo,
  TreeNode,
} from "../types";
import { DEFAULT_MODELS } from "../types";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface AppState {
  // ---- Auth / tokens (memória — nunca persistidos) ----
  gitToken: string | null;
  gitUsername: string | null;
  userAvatar: string | null;
  authSource: "supabase" | "device" | "manual" | null;
  setGitToken: (token: string | null, name?: string | null, avatar?: string | null, source?: "supabase" | "device" | "manual" | null) => void;

  // ---- Supabase / settings (persistidos) ----
  supabaseConfig: SupabaseConfig;
  setSupabaseConfig: (cfg: SupabaseConfig) => void;
  vendor: ModelVendor;
  setVendor: (v: ModelVendor) => void;
  apiKeys: ApiKeys;
  setApiKey: (vendor: keyof ApiKeys, key: string) => void;
  models: Record<RemoteVendor, string>;
  setModel: (vendor: RemoteVendor, model: string) => void;
  localModel: string;
  setLocalModel: (m: string) => void;
  agentEnabled: boolean;
  setAgentEnabled: (v: boolean) => void;
  syncApiKeys: boolean;
  setSyncApiKeys: (v: boolean) => void;
  profileLastSync: string | null;
  setProfileLastSync: (t: string | null) => void;

  // ---- Chat ----
  chat: ChatMessage[];
  appendChat: (m: ChatMessage) => void;
  replaceChat: (list: ChatMessage[]) => void;
  agentRunning: boolean;
  setAgentRunning: (v: boolean) => void;
  localProgress: LocalProgress;
  setLocalProgress: (p: LocalProgress) => void;

  // ---- Workspace ----
  activeRepo: string | null;
  setActiveRepo: (dir: string | null) => void;
  repositoryUrl: string | null;
  setRepositoryUrl: (url: string | null) => void;
  tree: TreeNode[];
  setTree: (t: TreeNode[]) => void;
  selectedPath: string | null;
  setSelectedPath: (p: string | null) => void;
  originalContent: string;
  modifiedContent: string;
  setContents: (original: string, modified: string) => void;
  setModified: (modified: string) => void;
  editorMode: "code" | "diff";
  setEditorMode: (m: "code" | "diff") => void;
  pendingChange: PendingChange | null;
  setPendingChange: (p: PendingChange | null) => void;
  syncInfo: SyncInfo;
  setSyncInfo: (s: SyncInfo) => void;
  storage: StorageInfo | null;
  setStorage: (s: StorageInfo) => void;
  repoDirs: string[];
  setRepoDirs: (d: string[]) => void;

  // ---- UI ----
  showStoragePanel: boolean;
  setShowStoragePanel: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showSyncModal: boolean;
  setShowSyncModal: (v: boolean) => void;
  toast: string | null;
  setToast: (t: string | null) => void;
}

const initialApiKeys: ApiKeys = { openai: "", anthropic: "", gemini: "", openrouter: "", groq: "" };

const initialModels: Record<RemoteVendor, string> = {
  openai: DEFAULT_MODELS.openai,
  anthropic: DEFAULT_MODELS.anthropic,
  gemini: DEFAULT_MODELS.gemini,
  openrouter: DEFAULT_MODELS.openrouter,
  groq: DEFAULT_MODELS.groq,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      gitToken: null,
      gitUsername: null,
      userAvatar: null,
      authSource: null,
      setGitToken: (token, name, avatar, source) => {
        if (token) {
          try {
            sessionStorage.setItem(
              "aicollider:git",
              JSON.stringify({ token, name: name ?? null, avatar: avatar ?? null, source: source ?? null })
            );
          } catch {
            /* storage indisponível */
          }
        } else {
          try {
            sessionStorage.removeItem("aicollider:git");
          } catch {
            /* storage indisponível */
          }
        }
        set({ gitToken: token, gitUsername: name ?? null, userAvatar: avatar ?? null, authSource: source ?? null });
      },

      supabaseConfig: { url: "", anonKey: "" },
      setSupabaseConfig: (cfg) => set({ supabaseConfig: cfg }),
      vendor: "local",
      setVendor: (v) => set({ vendor: v }),
      apiKeys: initialApiKeys,
      setApiKey: (vendor, key) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [vendor]: key } })),
      models: initialModels,
      setModel: (vendor, model) =>
        set((s) => ({ models: { ...s.models, [vendor]: model } })),
      localModel: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      setLocalModel: (m) => set({ localModel: m }),
      agentEnabled: true,
      setAgentEnabled: (v) => set({ agentEnabled: v }),
      syncApiKeys: false,
      setSyncApiKeys: (v) => set({ syncApiKeys: v }),
      profileLastSync: null,
      setProfileLastSync: (t) => set({ profileLastSync: t }),

      chat: [],
      appendChat: (m) => set((s) => ({ chat: [...s.chat, m] })),
      replaceChat: (list) => set({ chat: list }),
      agentRunning: false,
      setAgentRunning: (v) => set({ agentRunning: v }),
      localProgress: { loading: false, progress: 0, text: "" },
      setLocalProgress: (p) => set({ localProgress: p }),

      activeRepo: null,
      setActiveRepo: (r) => set({ activeRepo: r }),
      repositoryUrl: null,
      setRepositoryUrl: (u) => set({ repositoryUrl: u }),
      tree: [],
      setTree: (t) => set({ tree: t }),
      selectedPath: null,
      setSelectedPath: (p) => set({ selectedPath: p }),
      originalContent: "",
      modifiedContent: "",
      setContents: (original, modified) => set({ originalContent: original, modifiedContent: modified }),
      setModified: (modified) => set({ modifiedContent: modified }),
      editorMode: "code",
      setEditorMode: (m) => set({ editorMode: m }),
      pendingChange: null,
      setPendingChange: (p) => set({ pendingChange: p }),
      syncInfo: { status: "unknown" },
      setSyncInfo: (s) => set({ syncInfo: s }),
      storage: null,
      setStorage: (s) => set({ storage: s }),
      repoDirs: [],
      setRepoDirs: (d) => set({ repoDirs: d }),

      showStoragePanel: false,
      setShowStoragePanel: (v) => set({ showStoragePanel: v }),
      showSettings: false,
      setShowSettings: (v) => set({ showSettings: v }),
      showSyncModal: false,
      setShowSyncModal: (v) => set({ showSyncModal: v }),
      toast: null,
      setToast: (t) => set({ toast: t }),
    }),
    {
      name: "aicollider-settings",
      partialize: (s) => ({
        supabaseConfig: s.supabaseConfig,
        vendor: s.vendor,
        apiKeys: s.apiKeys,
        models: s.models,
        localModel: s.localModel,
        agentEnabled: s.agentEnabled,
        syncApiKeys: s.syncApiKeys,
        activeRepo: s.activeRepo,
        repositoryUrl: s.repositoryUrl,
        repoDirs: s.repoDirs,
      }),
    }
  )
);

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);