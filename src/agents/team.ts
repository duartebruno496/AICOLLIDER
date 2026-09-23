import type { ChatMessage } from "../types";
import { uid } from "../store/useAppStore";
import type { LLMProvider } from "../lib/llm/types";
import { Orchestrator, type OrchestratorRunResult } from "./orchestrator";
import { useAppStore } from "../store/useAppStore";

/**
 * Equipe pré-criada: PM planeja → Engenheiro executa → Revisor valida.
 * Cada fase roda com o próprio perfil do registry (tools restritas por skill):
 * o PM e o Revisor NÃO têm a skill 'write-code', então não conseguem propor diffs.
 */
export class TeamOrchestrator {
  constructor(
    private provider: LLMProvider,
    private repo: string
  ) {}

  async run(chat: ChatMessage[]): Promise<OrchestratorRunResult> {
    if (!this.provider.available()) {
      throw new Error("Provedor de IA não disponível. Configure uma chave ou habilite WebGPU.");
    }
    const cfg = useAppStore.getState().agentConfig;
    const temperature = Number.isFinite(cfg?.temperature) ? cfg.temperature : 0.3;
    const teamMaxSteps = Number.isFinite(cfg?.maxSteps) ? Math.min(40, Math.max(1, Math.round(cfg.maxSteps))) : 14;
    const phaseSteps = Math.max(4, Math.ceil(teamMaxSteps / 3));

    // Fase 1 — PM: planeja sem mexer em nada (não tem write-code).
    const pm = new Orchestrator(this.provider, this.repo, "pm");
    const plan = await pm.run(chat.concat([{ id: uid(), role: "user", content: "Elabore o plano para esta tarefa." }]), phaseSteps);

    // Fase 2 — Engenheiro: executa o plano, propondo diffs (aguarda aprovação).
    const execChat: ChatMessage[] = [
      ...chat,
      { id: uid(), role: "assistant", content: `[Plano do PM]\n${plan.finalText}` },
    ];
    const engineer = new Orchestrator(this.provider, this.repo, "engineer");
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
      finalText: `🧭 **Plano (PM):**\n${plan.finalText}\n\n👷 **Execução (Engenheiro):**\n${exec.finalText}\n\n🔍 **Veredito (Revisor):**\n${verdict.finalText}`,
      appliedChanges: applied,
    };
  }
}