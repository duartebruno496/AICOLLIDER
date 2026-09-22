import type { LLMMessage, LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from "../types";
import { parseToolArgs } from "../types";

type Part =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export class GeminiProvider implements LLMProvider {
  readonly kind = "remote" as const;
  readonly vendor = "gemini" as const;
  readonly label = "Google Gemini (remoto)";

  constructor(
    private apiKey: string,
    readonly model: string
  ) {}

  available(): boolean {
    return this.apiKey.trim().length > 0;
  }

  private static toWire(messages: LLMMessage[]): { system: string; contents: Array<{ role: "user" | "model"; parts: Part[] }> } {
    let system = "";
    const contents: Array<{ role: "user" | "model"; parts: Part[] }> = [];

    for (const m of messages) {
      if (m.role === "system") {
        system += (system ? "\n" : "") + (m.content ?? "");
        continue;
      }
      if (m.role === "tool") {
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: m.name ?? "tool",
                response: { result: m.content ?? "" },
              },
            },
          ],
        });
        continue;
      }
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.role === "assistant" && m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: parseToolArgs(tc.arguments) } });
        }
      }
      if (parts.length) contents.push({ role: m.role === "assistant" ? "model" : "user", parts });
    }
    return { system, contents };
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const { system, contents } = GeminiProvider.toWire(req.messages);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { temperature: req.temperature ?? 0.4 },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (req.tools?.length) {
      body.tools = [
        {
          functionDeclarations: req.tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters as Record<string, unknown>,
          })),
        },
      ];
      body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini respondeu HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Part[] };
        finishReason?: string;
      }>;
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const toolCalls: LLMToolCall[] = [];
    let content = "";
    for (const p of parts) {
      if ("text" in p && p.text) content += p.text;
      if ("functionCall" in p && p.functionCall) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).slice(2, 8)}`,
          name: p.functionCall.name,
          arguments: JSON.stringify(p.functionCall.args ?? {}),
        });
      }
    }
    return { content, toolCalls, stopReason: json.candidates?.[0]?.finishReason };
  }
}