import type { LLMProvider, LLMRequest, LLMResponse, LLMToolCall } from "../types";
import { normalizeLLMMessages } from "../types";

declare global {
  interface Navigator {
    gpu?: unknown;
  }
}

export class LocalWebLLMProvider implements LLMProvider {
  readonly kind = "local" as const;
  readonly vendor = "local" as const;
  readonly label = "WebLLM local (WebGPU/WASM)";
  readonly model: string;

  private engine: {
    chat: { completions: { create(opts: Record<string, unknown>): Promise<{ choices: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function: { name: string; arguments: string } }> } }> }> } };
  } | null = null;

  constructor(
    model: string,
    private onInitProgress?: (p: { loading: boolean; progress: number; text: string }) => void
  ) {
    this.model = model;
  }

  available(): boolean {
    return typeof navigator !== "undefined" && !!navigator.gpu;
  }

  private async ensureEngine(): Promise<typeof this.engine> {
    if (this.engine) return this.engine;
    const report = (progress: number, text: string) => this.onInitProgress?.({ loading: progress < 1, progress, text });
    this.onInitProgress?.({ loading: true, progress: 0, text: "Iniciando WebLLM e detectando WebGPU..." });
    const webllm = await import("@mlc-ai/web-llm");
    let last = 0;
    this.engine = (await webllm.CreateMLCEngine(this.model, {
      initProgressCallback: (p) => {
        const percent = Math.round((p.progress ?? 0) * 100);
        if (percent !== last) {
          last = percent;
          report(p.progress ?? 0, p.text ?? `Baixando ${this.model}...`);
        }
      },
    })) as unknown as typeof this.engine;
    report(1, `${this.model} carregado.`);
    this.onInitProgress?.({ loading: false, progress: 1, text: "" });
    return this.engine;
  }

  async chat(req: LLMRequest): Promise<LLMResponse> {
    const engine = await this.ensureEngine();
    if (!engine) throw new Error("Engine WebLLM não inicializada.");
    const tools = req.tools?.map((t) => ({
      type: "function",
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
    const messages = normalizeLLMMessages(req.messages).map((m) => {
      if (m.role === "system") return { role: "system", content: m.content ?? "" };
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
      if (m.role === "tool") {
        return { role: "tool", tool_call_id: m.toolCallId, content: m.content ?? "" };
      }
      return { role: "user", content: m.content ?? "" };
    });

    const result = (await engine.chat.completions.create({
      messages,
      temperature: req.temperature ?? 0.4,
      stream: false,
      ...(tools?.length ? { tools, tool_choice: "auto" as const } : {}),
    })) as {
      choices?: Array<{
        message?: { content?: string | null; tool_calls?: Array<{ id?: string; function: { name: string; arguments: string } }> };
        finish_reason?: string;
      }>;
    };

    const choice = result.choices?.[0];
    const msg = choice?.message;
    const toolCalls: LLMToolCall[] = (msg?.tool_calls ?? []).map((tc) => ({
      id: tc.id ?? `call_${Math.random().toString(36).slice(2, 8)}`,
      name: tc.function.name,
      arguments: tc.function.arguments ?? "{}",
    }));
    return { content: msg?.content ?? "", toolCalls, stopReason: choice?.finish_reason ?? "stop" };
  }
}