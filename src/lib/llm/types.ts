import type { ModelVendor } from "../../types";

export interface LLMToolCall {
  id: string;
  name: string;
  /** JSON string with the arguments */
  arguments: string;
}

export interface LLMToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls: LLMToolCall[];
  stopReason?: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools?: LLMToolDef[];
  temperature?: number;
  onStream?: (text: string) => void;
}

export interface LLMProvider {
  readonly kind: "remote" | "local";
  readonly vendor: ModelVendor;
  readonly label: string;
  readonly model: string;
  available(): boolean;
  chat(req: LLMRequest): Promise<LLMResponse>;
}

export const DEFAULT_MODELS: Record<ModelVendor, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.0-flash",
  local: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
};

export function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}