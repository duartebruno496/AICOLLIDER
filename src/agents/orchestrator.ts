import type { ChatMessage } from "../types";
import { useAppStore } from "../store/useAppStore";
import type { LLMMessage, LLMProvider, LLMToolCall } from "../lib/llm/types";
import { parseToolArgs } from "../lib/llm/types";
import { TOOLS } from "./tools";
import { CoderAgent } from "./coder";
import { ReviewerAgent } from "./reviewer";
import { waitForApproval } from "./diffGateway";

const SYSTEM_PROMPT = `Você é o AICOLLIDER, um engenheiro de software sênior assistente de Vibe Coding que trabalha DENTRO do repositório virtual do usuário.

REGRAS RESTRITAS DE DEPLOY E INFRA:
1. Você NUNCA pode usar SSH, FTP, SFTP, rsync, scp ou qualquer ferramenta de conexão direta a servidores. Não existe rede de deploy.
2. Se o usuário pedir deploy/CI/CD/publicação, gere EXCLUSIVAMENTE arquivos de workflow do GitHub Actions dentro de .github/workflows/ usando a tool suggestCodeChange.
3. Nada de comandos bash de terminal do SO: todo o ambiente é virtual (IndexedDB). A única forma de mudar arquivos é a tool suggestCodeChange.
4. Siga este padrão VÁLIDO de workflow ao gerar deploys (ajuste versões/passos): use "actions/checkout@v4", "actions/setup-node@v4" com node-version 20 e "npm ci"+"npm run build". Para Pages html, use "actions/upload-pages-artifact@v3" e "actions/deploy-pages@v4" com permissions pages id-token write e environment github-pages.

FLUXO DE TRABALHO:
- Você recebe uma instrução. Comece respondendo com uma linha curta "Plano: ..." listando os passos.
- Use listFiles para ver o projeto, readFile para ler arquivos e ENTÃO sugira mudanças com suggestCodeChange.
- suggestCodeChange NUNCA salva direto: um humano precisa clicar em "Aceitar" no diff. Se a tool retornar que a mudança foi rejeitada, respeite a decisão e ajuste ou desista.
- Ao criar arquivos use sempre o conteúdo COMPLETO do arquivo.
- Responda de forma objetiva em português.`;

export interface OrchestratorRunResult {
  finalText: string;
  appliedChanges: number;
}

export class Orchestrator {
  private coder: CoderAgent;
  private reviewer = new ReviewerAgent();

  constructor(
    private provider: LLMProvider,
    repo: string
  ) {
    this.coder = new CoderAgent(repo);
  }

  private async executeTool(tc: LLMToolCall): Promise<{ result: string; wasApproval: boolean }> {
    const args = parseToolArgs(tc.arguments);
    switch (tc.name) {
      case "listFiles": {
        const path = typeof args.path === "string" ? args.path : "";
        return { result: await this.coder.listFiles(path), wasApproval: false };
      }
      case "readFile": {
        const path = typeof args.path === "string" ? args.path : "";
        return { result: await this.coder.readFile(path), wasApproval: false };
      }
      case "suggestCodeChange": {
        const path = typeof args.path === "string" ? args.path : "";
        const content = typeof args.content === "string" ? args.content : "";
        const reason = typeof args.reason === "string" ? args.reason : "solicitação do usuário";
        if (!path) return { result: "FALHOU: 'path' é obrigatório.", wasApproval: false };
        if (!content) return { result: "FALHOU: 'content' é obrigatório.", wasApproval: false };

        const change = await this.coder.captureChange(path, content);
        const verdict = this.reviewer.review(change);
        if (!verdict.ok) {
          return {
            result: `FALHOU na revisão de qualidade de '${path}':\n- ${verdict.issues.join("\n- ")}\nCorrija o conteúdo e tente novamente.`,
            wasApproval: false,
          };
        }

        const approved = await waitForApproval({ ...change, reason });
        if (approved) {
          await this.coder.applyApprovedChange(change);
          return { result: `APROVADO pelo humano e commitado: '${path}'.`, wasApproval: true };
        }
        return { result: `REJEITADO pelo humano: '${path}' não foi salvo. Não insista; proponha outra abordagem ou encerre.`, wasApproval: true };
      }
      default:
        return { result: `FALHOU: tool desconhecida '${tc.name}'.`, wasApproval: false };
    }
  }

  private toLLM(chat: ChatMessage[]): LLMMessage[] {
    const out: LLMMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Repositório aberto: ${this.coder["repo"]}` },
    ];
    for (const m of chat) {
      if (m.role === "user") out.push({ role: "user", content: m.content });
      if (m.role === "assistant") out.push({ role: "assistant", content: m.content });
    }
    return out;
  }

  async run(chat: ChatMessage[]): Promise<OrchestratorRunResult> {
    if (!this.provider.available()) {
      throw new Error("Provedor de IA não disponível. Configure uma chave ou habilite WebGPU.");
    }
    const messages = this.toLLM(chat);
    let appliedChanges = 0;
    let finalText = "";

    for (let i = 0; i < 14; i++) {
      const res = await this.provider.chat({ messages, tools: TOOLS, temperature: 0.3 });

      if (res.content && res.toolCalls.length === 0) {
        finalText = res.content;
        break;
      }

      if (res.toolCalls.length === 0) {
        finalText = res.content;
        break;
      }

      messages.push({
        role: "assistant",
        content: res.content || null,
        toolCalls: res.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, arguments: tc.arguments })),
      });

      let anyFailure = false;
      for (const tc of res.toolCalls) {
        const { result, wasApproval } = await this.executeTool(tc);
        if (wasApproval && result.startsWith("APROVADO")) appliedChanges += 1;
        if (result.startsWith("FALHOU") || result.startsWith("REJEITADO")) anyFailure = true;
        messages.push({ role: "tool", toolCallId: tc.id, name: tc.name, content: result });
      }

      if (anyFailure && i >= 3) {
        finalText = "Encontrei obstáculos. A requisição mais recente foi interrompida após falhas repetidas.";
        break;
      }
    }

    return { finalText: finalText || "Concluído.", appliedChanges };
  }
}