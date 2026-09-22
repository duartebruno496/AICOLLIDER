import type { LLMMessage, LLMResponse, LLMToolCall } from "./types";

/** Chamada genérica para APIs OpenAI-compatible (OpenAI real + WebLLM local). */
export async function openAiCompatibleChat(params: {
  url: string;
  apiKey?: string;
  model: string;
  messages: LLMMessage[];
  tools?: Parameters<import("./types").LLMProvider["chat"]>[0]["tools"];
  temperature?: number;
  signal?: AbortSignal;
}): Promise<LLMResponse> {
  const { url, apiKey, model, messages, tools, temperature, signal } = params;

  const wire = messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content ?? "",
      };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });

  const body: Record<string, unknown> = { model, messages: wire, temperature: temperature ?? 0.4 };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${model} respondeu HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason?: string;
    }>;
  };
  const choice = json.choices?.[0];
  const message = choice?.message;
  const toolCalls: LLMToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
    id: tc.id ?? `call_${Math.random().toString(36).slice(2, 8)}`,
    name: tc.function.name,
    arguments: tc.function.arguments ?? "{}",
  }));
  return { content: message?.content ?? "", toolCalls, stopReason: choice?.finish_reason };
}