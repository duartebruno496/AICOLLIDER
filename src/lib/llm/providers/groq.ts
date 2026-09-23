import type { LLMProvider, LLMRequest, LLMResponse } from "../types";
import { openAiCompatibleChat } from "../openai-compatible";

export class GroqProvider implements LLMProvider {
  readonly kind = "remote" as const;
  readonly vendor = "groq" as const;
  readonly label = "Groq (remoto)";

  constructor(
    private apiKey: string,
    readonly model: string
  ) {}

  available(): boolean {
    return this.apiKey.trim().length > 0;
  }

  chat(req: LLMRequest): Promise<LLMResponse> {
    return openAiCompatibleChat({
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: this.apiKey,
      model: this.model,
      messages: req.messages,
      tools: req.tools,
      temperature: req.temperature,
    });
  }
}