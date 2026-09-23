export type ProviderKind = "remote" | "local";
export type RemoteVendor = "openai" | "anthropic" | "gemini" | "openrouter" | "groq";
export type ModelVendor = RemoteVendor | "local";

export interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
  openrouter: string;
  groq: string;
}

/** Modelos padrão por provedor (usados quando o usuário não escolhe um modelo). */
export const DEFAULT_MODELS: Record<ModelVendor, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.0-flash",
  openrouter: "deepseek/deepseek-chat-v3.1:free",
  groq: "llama-3.3-70b-versatile",
  local: "Hermes-3-Llama-3.1-8B-q4f16_1-MLC",
};

export interface AgentConfig {
  temperature: number;
  maxSteps: number;
}

/** Modo de envio da mensagem no chat: conversa normal (sem tools) ou agente (manipula o FS virtual). */
export type ChatMode = "chat" | "agent";

/** Repositório interno de rascunho usado pelo "Editor sem projeto" (oculto das listas). */
export const SCRATCH_REPO = "_scratch";

/** Padrões do Modo Agente: conectou a IA, já funciona sem configurar nada. */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  temperature: 0.3,
  maxSteps: 14,
};

export interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: TreeNode[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
}

export interface ToolCallArg {
  name: string;
  arguments: Record<string, unknown>;
}

export interface PendingChange {
  path: string;
  original: string;
  modified: string;
  reason?: string;
  fromAgent: boolean;
  /** Rótulo de quem propôs (ex.: "Engenheiro", "Revisor"). */
  from?: string;
}

export interface StorageInfo {
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usagePercent: number;
  overWarning: boolean;
  overLimit: boolean;
}

export interface SyncInfo {
  status: "in-sync" | "behind" | "ahead" | "diverged" | "unknown";
  localHash?: string;
  remoteHash?: string;
  aheadCount?: number;
  behindCount?: number;
}

export interface LocalProgress {
  loading: boolean;
  progress: number;
  text: string;
}

export interface Todo {
  step: string;
  status: "pending" | "done";
}