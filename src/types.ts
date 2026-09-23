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
  openrouter: "meta-llama/llama-3.3-70b-instruct",
  groq: "llama-3.3-70b-versatile",
  local: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
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