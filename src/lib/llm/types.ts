import type { ModelVendor } from "../../types";
export { DEFAULT_MODELS } from "../../types";

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

export function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Une todas as mensagens system em UMA única, sempre na primeira posição (exigência de WebLLM/Groq/etc). */
export function normalizeLLMMessages(messages: LLMMessage[]): LLMMessage[] {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content ?? "")
    .filter(Boolean)
    .join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  if (!system) return rest;
  return [{ role: "system", content: system }, ...rest];
}