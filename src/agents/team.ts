import type { ChatMessage } from "../types";
import { uid } from "../store/useAppStore";
import type { LLMProvider } from "../lib/llm/types";
import { Orchestrator, type OrchestratorRunResult } from "./orchestrator";
import { useAppStore } from "../store/useAppStore";
import { getAgent } from "./registry";

/**
 * Equipe pré-criada: PM planeja → Engenheiro executa → Revisor valida.
 * Cada fase roda com o próprio perfil do registry (tools restritas por skill):
 * o PM e o Revisor NÃO têm a skill 'write-code', então não conseguem propor diffs.
 */
/**
 * Extrai o texto-chave do plano do PM (ignora o resto da resposta).
 * O Engenheiro recebe SÓ o plano — nunca o histórico do chat, para não
 * re-executar pedidos antigos já resolvidos.
 */
function extractPlan(finalText: string): { isTask: boolean; plan: string } {
  const match = /Plano[:：]\s*\n?/.exec(finalText);
  if (match) {
    return { isTask: true, plan: finalText.slice(match.index + match[0].length).trim() };
  }
  return { isTask: false, plan: finalText.trim() };
}

export class TeamOrchestrator {
  constructor(
    private provider: LLMProvider,
    private repo: string,
    /** Perfil usado na fase de execução (default: engenheiro). Ex.: "security", "uiux". */
    private focusAgent = "engineer"
  ) {}

  async run(chat: ChatMessage[]): Promise<OrchestratorRunResult> {
    if (!this.provider.available()) {
      throw new Error("Provedor de IA não disponível. Configure uma chave ou habilite WebGPU.");
    }
    const cfg = useAppStore.getState().agentConfig;
    const temperature = Number.isFinite(cfg?.temperature) ? cfg.temperature : 0.3;
    const teamMaxSteps = Number.isFinite(cfg?.maxSteps) ? Math.min(40, Math.max(1, Math.round(cfg.maxSteps))) : 14;
    const phaseSteps = Math.max(4, Math.ceil(teamMaxSteps / 3));

    // Fase 1 — PM: decide entre conversa e tarefa (e planeja se for tarefa).
    const pm = new Orchestrator(this.provider, this.repo, "pm");
    const last = chat[chat.length - 1];
    const convRequest: ChatMessage = { id: uid(), role: "user", content: `A última mensagem do usuário foi: "${last.content}". Se for apenas CONVERSA (saudação, pergunta casual, dúvida sem pedido de edição), responda de forma conversacional sem criar plano. Se for uma TAREFA, responda EXATAMENTE neste formato:\n\nPlano:\n1. ...\n2. ...` };
    const planResult = await pm.run(chat.concat([convRequest]), phaseSteps);

    const { isTask, plan } = extractPlan(planResult.finalText);
    if (!isTask) {
      // Só conversa: o PM respondeu normalmente, sem execução.
      return { finalText: planResult.finalText, appliedChanges: 0 };
    }

    // Fase 2 — Agente focado (default: engenheiro): executa APENAS o plano (não o histórico do chat).
    // Se o perfil focado não pode escrever (ex.: @security, @pm, @review), entrega como relatório
    // do especialista em vez de tentar editar sem a skill.
    const focus = getAgent(this.focusAgent);
    const focusCanWrite = !!focus?.skills.includes("write-code");
    const execChat: ChatMessage[] = [
      { id: uid(), role: "user", content: `Execute exatamente o plano abaixo, propondo as mudanças necessárias com sugestão de diff.` },
      { id: uid(), role: "assistant", content: `[Plano do PM]\n${plan}` },
    ];

    if (!focusCanWrite) {
      const specialist = new Orchestrator(this.provider, this.repo, this.focusAgent);
      const verdict = await specialist.run(
        [
          ...execChat,
          { id: uid(), role: "assistant", content: `[Análise do especialista]\n${plan}\n\nApresente sua análise e recomendações (não deve editar arquivos).` },
        ],
        phaseSteps
      );
      return {
        finalText: `🧭 **Plano (PM):**\n${plan}\n\n🛡️ **Análise especialista (@${this.focusAgent}):**\n${verdict.finalText}`,
        appliedChanges: 0,
      };
    }

    const engineer = new Orchestrator(this.provider, this.repo, this.focusAgent);
    const exec = await engineer.run(execChat, phaseSteps);

    // Fase 3 — Revisor: veredito de qualidade/segurança (sem editar).
    const review = new Orchestrator(this.provider, this.repo, "reviewer");
    const verdict = await review.run(
      [
        ...execChat,
        { id: uid(), role: "assistant", content: `[Resumo da execução]\n${exec.finalText}\n\nEmita seu veredito de qualidade.` },
      ],
      phaseSteps
    );

    const applied = exec.appliedChanges;
    return {
      finalText: `🧭 **Plano (PM):**\n${plan}\n\n👷 **Execução (Engenheiro):**\n${exec.finalText}\n\n🔍 **Veredito (Revisor):**\n${verdict.finalText}`,
      appliedChanges: applied,
    };
  }
}