import type { ChatMessage, RemoteVendor } from "../../types";
import { useAppStore } from "../../store/useAppStore";
import type { LLMMessage, LLMProvider } from "./types";
import { DEFAULT_MODELS } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { GroqProvider } from "./providers/groq";
import { LocalWebLLMProvider } from "./providers/local";

let localProvider: LocalWebLLMProvider | null = null;

const REMOTE_BUILDERS: Record<RemoteVendor, (key: string, model: string) => LLMProvider> = {
  openai: (k, m) => new OpenAIProvider(k, m),
  anthropic: (k, m) => new AnthropicProvider(k, m),
  gemini: (k, m) => new GeminiProvider(k, m),
  openrouter: (k, m) => new OpenRouterProvider(k, m),
  groq: (k, m) => new GroqProvider(k, m),
};

export function buildProvider(): LLMProvider {
  const { vendor, apiKeys, models, localModel } = useAppStore.getState();
  if (vendor !== "local") {
    const build = REMOTE_BUILDERS[vendor];
    if (build) return build(apiKeys[vendor].trim(), (models[vendor] || DEFAULT_MODELS[vendor]).trim());
  }
  {
    if (!localProvider) {
      localProvider = new LocalWebLLMProvider(localModel, (p) => {
        useAppStore.getState().setLocalProgress(p);
      });
    }
    if (localProvider.model !== localModel) {
      localProvider = new LocalWebLLMProvider(localModel, (p) => {
        useAppStore.getState().setLocalProgress(p);
      });
    }
    return localProvider;
  }
}

export function providerAvailable(): boolean {
  const p = buildProvider();
  return p.available();
}

function toLLMMessages(chat: ChatMessage[]): LLMMessage[] {
  const out: LLMMessage[] = [];
  for (const m of chat) {
    if (m.role === "system") out.push({ role: "system", content: m.content });
    if (m.role === "user") out.push({ role: "user", content: m.content });
    if (m.role === "assistant") out.push({ role: "assistant", content: m.content });
  }
  return out;
}

/** Chat simples (Sprint 4): histórico + resposta sem tools. */
export async function simpleChat(messages: ChatMessage[]): Promise<{ assistant: string; provider: LLMProvider }> {
  const provider = buildProvider();
  if (!provider.available()) {
    throw new Error(
      provider.kind === "local"
        ? "WebGPU indisponível neste navegador. Use Chrome/Edge com WebGPU habilitado ou adicione uma chave de API remota."
        : "Configure a chave da API nas Configurações antes de usar este provedor."
    );
  }
  const res = await provider.chat({ messages: toLLMMessages(messages) });
  return { assistant: res.content, provider };
}