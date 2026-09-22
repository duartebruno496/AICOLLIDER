export type ProviderKind = "remote" | "local";
export type ModelVendor = "openai" | "anthropic" | "gemini" | "local";

export interface ApiKeys {
  openai: string;
  anthropic: string;
  gemini: string;
}

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