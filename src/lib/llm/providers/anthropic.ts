import type { LLMMessage, LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from "../types";
import { parseToolArgs } from "../types";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export class AnthropicProvider implements LLMProvider {
  readonly kind = "remote" as const;
  readonly vendor = "anthropic" as const;
  readonly label = "Anthropic (remoto)";

  constructor(
    private apiKey: string,
    readonly model: string
  ) {}

  available(): boolean {
    return this.apiKey.trim().length > 0;
  }

  private static toWire(messages: LLMMessage[]): { system: string; msgs: Array<{ role: "user" | "assistant"; content: AnthropicContentBlock[] }> } {
    let system = "";
    const msgs: Array<{ role: "user" | "assistant"; content: AnthropicContentBlock[] }> = [];

    for (const m of messages) {
      if (m.role === "system") {
        system += (system ? "\n" : "") + (m.content ?? "");
        continue;
      }
      if (m.role === "tool") {
        msgs.push({
          role: "user",
          content: [{ type: "tool_result", tool_use_id: m.toolCallId ?? "", content: m.content ?? "" }],
        });
        continue;
      }
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      if (m.role === "assistant" && m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: parseToolArgs(tc.arguments) });
        }
      }
      msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: blocks });
    }

    if (msgs.length && msgs[msgs.length - 1].role === "assistant") {
      msgs.push({ role: "user", content: [{ type: "text", text: "Continue." }] });
    }
    return { system, msgs };
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const { system, msgs } = AnthropicProvider.toWire(req.messages);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      temperature: req.temperature ?? 0.4,
      messages: msgs,
    };
    if (system) body.system = system;
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Record<string, unknown>,
      }));
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic respondeu HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
    };
    const toolCalls: LLMToolCall[] = [];
    let content = "";
    for (const block of json.content) {
      if (block.type === "text" && block.text) content += block.text;
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id ?? `call_${Math.random().toString(36).slice(2, 8)}`,
          name: block.name ?? "",
          arguments: JSON.stringify(block.input ?? {}),
        });
      }
    }
    return { content, toolCalls };
  }
}