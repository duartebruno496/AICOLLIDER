import type { LLMProvider, LLMRequest, LLMResponse, LLMToolCall, LLMToolDef } from "../types";
import { normalizeLLMMessages } from "../types";

declare global {
  interface Navigator {
    gpu?: unknown;
  }
}

/** Modelos WebLLM (MLC) com function calling nativo via campo `tools` — fonte: erro oficial do WebLLM. */
export function localModelSupportsTools(model: string): boolean {
  return /hermes/i.test(model);
}

/** Converte os schemas de tools em instruções no formato Hermes (<tool_call>). */
export function buildToolInstructions(tools: LLMToolDef[]): string {
  const list = tools
    .map((t) =>
      JSON.stringify({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })
    )
    .join(",\n");
  return [
    "Você tem acesso às seguintes funções:",
    "",
    "<functions>",
    list,
    "</functions>",
    "",
    "Se precisar usar uma função, responda EXATAMENTE com o bloco a seguir (nada antes nem depois), em JSON válido:",
    '<tool_call>{"name": "nome_da_funcao", "arguments": { ... }}</tool_call>',
    "Se não precisar de função, responda normalmente em português.",
  ].join("\n");
}

/** Extrai chamadas de ferramenta no formato Hermes de uma resposta em texto. */
export function extractManualToolCalls(content: string): LLMToolCall[] {
  const out: LLMToolCall[] = [];
  const re = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim()) as { name?: unknown; arguments?: unknown };
      const name = typeof parsed?.name === "string" ? parsed.name : "";
      const args = parsed?.arguments && typeof parsed.arguments === "object" ? parsed.arguments : {};
      if (name) {
        out.push({
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          name,
          arguments: JSON.stringify(args),
        });
      }
    } catch {
      // bloco inválido — ignora
    }
  }
  return out;
}

/** Remove blocos de tool calling/raciocínio do texto final exibido ao usuário. */
export function stripManualToolCalls(content: string): string {
  return content
    .replace(/<scratch_pad>[\s\S]*?<\/scratch_pad>/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .trim();
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
    const nativeTools =
      localModelSupportsTools(this.model) && req.tools?.length
        ? req.tools.map((t) => ({
            type: "function",
            function: {
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            },
          }))
        : undefined;
    let messages = normalizeLLMMessages(req.messages).map((m) => {
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

    // Modo manual (modelos fora da allowlist de tools): descreve as funções no system prompt
    // para o modelo emitir <tool_call>… em texto (formato Hermes), sem usar o campo `tools`.
    if (!nativeTools && req.tools?.length) {
      const instructions = buildToolInstructions(req.tools);
      const sysIdx = messages.findIndex((m) => m.role === "system");
      if (sysIdx >= 0) {
        messages[sysIdx] = { role: "system", content: `${messages[sysIdx].content}\n\n${instructions}` };
      } else {
        messages = [{ role: "system", content: instructions }, ...messages];
      }
    }

    const result = (await engine.chat.completions.create({
      messages,
      temperature: req.temperature ?? 0.4,
      stream: false,
      ...(nativeTools?.length ? { tools: nativeTools, tool_choice: "auto" as const } : {}),
    })) as {
      choices?: Array<{
        message?: { content?: string | null; tool_calls?: Array<{ id?: string; function: { name: string; arguments: string } }> };
        finish_reason?: string;
      }>;
    };

    const choice = result.choices?.[0];
    const msg = choice?.message;
    const raw = msg?.content ?? "";
    let toolCalls: LLMToolCall[] = (msg?.tool_calls ?? []).map((tc) => ({
      id: tc.id ?? `call_${Math.random().toString(36).slice(2, 8)}`,
      name: tc.function.name,
      arguments: tc.function.arguments ?? "{}",
    }));
    let content = raw;
    if (!nativeTools && toolCalls.length === 0 && raw) {
      toolCalls = extractManualToolCalls(raw);
      content = stripManualToolCalls(raw);
    }
    return { content, toolCalls, stopReason: choice?.finish_reason ?? "stop" };
  }
}