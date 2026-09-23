import type { AutonomyLevel } from "../types";
import { getAgents, getAgent } from "./registry";

/**
 * Roteador do loop único: decide se a mensagem é CONVERSA ou TAREFA,
 * qual agente usar (menções @nome) e se a equipe é necessária.
 *
 * O roteador é determinístico e barato (sem chamada de LLM):
 * - `@nome` força um especialista (ex.: @security, @ui/ux).
 * - `/exec` força execução mesmo em "guided".
 * - `/plano` força plano antes de executar mesmo em "full".
 * - `/conversa` força resposta sem tools.
 * - Heurística de intenção (keywords) decide conversa vs tarefa.
 */

export type RouteKind = "chat" | "task";

export interface RouteDecision {
  kind: RouteKind;
  /** Texto limpo (menções @ e comandos / removidos). */
  text: string;
  /** Autonomia efetiva após overrides por comando. */
  autonomy: AutonomyLevel;
  /** Perfil alvo do agente (ex.: "engineer", "security", "uiux"). */
  agentId: string;
  /** Se a equipe (PM→Engenheiro→Revisor) deve ser acionada. */
  useTeam: boolean;
  /** Quem detectou: comando explícito ou heurística. */
  via: "mention" | "slash" | "heuristic" | "chat";
}

/** Aliases aceitos para cada agente nas menções @. */
const AGENT_MENTIONS: Record<string, string> = {
  engenheiro: "engineer",
  engineer: "engineer",
  fullstack: "fullstack",
  dev: "fullstack",
  uiux: "uiux",
  "ui/ux": "uiux",
  "ui-ux": "uiux",
  interface: "uiux",
  design: "uiux",
  security: "security",
  seguranca: "security",
  segurança: "security",
  pm: "pm",
  planejamento: "pm",
  plan: "pm",
  reviewer: "reviewer",
  revisor: "reviewer",
  revisao: "reviewer",
  revisão: "reviewer",
};

/** Expressões que indicam que é só conversa (checadas após menções/comandos). */
const CHAT_HINTS = [
  /\b(oi|olá|ola|e aí|ei|bom dia|boa tarde|boa noite)\b/i,
  /\b(obrigado|obrigada|valeu|vlw|tks|thanks)\b/i,
  /\b(como você funciona|como funciona|quem é você|o que você faz)\b/i,
  /\b(tudo bem|como vai|como está)\b/i,
];

/** Keywords que indicam intenção de TAREFA (mexer no código). */
const TASK_HINTS = [
  /\b(crie|criar|cria|fazer|faça|faca|faço|criando|implement(e|ar)?|desenvolva|desenvolver|gerar|gera)\b/i,
  /\b(alter(e|ar)?|mude|mudar|edite|editar|modifica|modificar|adicione|adicionar|remove|remover|exclua|apague|apagar)\b/i,
  /\b(corrige|corrigir|fix|fixar|bug|bugfix|refatore|refatorar|otimiz(e|ar)?|reescreva|reescrever)\b/i,
  /\b(arquivo|arquivos|função|funcao|componente|página|pagina|tela|readme|script|workflow|deploy)\b/i,
  /\b(escreva|escrever|adiciona|adicionar|atualiza|atualizar|documenta|documente)\b/i,
];

/** Nomes de @especialistas válidos para a ajuda (built-in + custom). */
export function mentionLabels(): { id: string; name: string; role: string }[] {
  return getAgents().map((a) => ({ id: a.id, name: a.name, role: a.role }));
}

/** Remove comandos /xxx do texto e devolve os flags. */
function parseSlash(text: string): { text: string; forceExecute: boolean; forcePlan: boolean; forceChat: boolean } {
  const list = text.split(/\s+/);
  const kept: string[] = [];
  let forceExecute = false;
  let forcePlan = false;
  let forceChat = false;
  for (const w of list) {
    const t = w.toLowerCase();
    if (t === "/exec" || t === "/execute") forceExecute = true;
    else if (t === "/plano" || t === "/plan") forcePlan = true;
    else if (t === "/conversa" || t === "/talk") forceChat = true;
    else kept.push(w);
  }
  return { text: kept.join(" ").trim(), forceExecute, forcePlan, forceChat };
}

/** Extrai a primeira menção `@nome` e remove do texto. */
function parseMention(text: string): { text: string; agentId: string | null } {
  const match = /(^|\s)@([\w/.-]+)/.exec(text);
  if (!match) return { text, agentId: null };
  const token = match[2].toLowerCase();
  const agentId = AGENT_MENTIONS[token] ?? null;
  const stripped = text.slice(0, match.index) + " " + text.slice(match.index + match[0].length);
  return { text: stripped.trim(), agentId };
}

/** Detecta se o texto sugere uma equipe (múltiplas áreas). */
function wantsTeam(agentId: string, text: string): boolean {
  if (agentId === "pm" || agentId === "reviewer") return true;
  if (/\b(equipe|time|team|tudo|completo|inteiro|projeto todo)\b/i.test(text) || /\btodos os\b/i.test(text)) return true;
  // Duas ou mais áreas diferentes citadas → equipe.
  let areas = 0;
  if (/\b(ui|ux|interface|tela|visual|css|design)\b/i.test(text)) areas += 1;
  if (/\b(segur|security|vulnerabil|injeção|injeção)\b/i.test(text)) areas += 1;
  if (/\b(api|backend|banco|database|db|servidor|endpoint)\b/i.test(text)) areas += 1;
  if (/\b(deploy|workflow|ci|cd|pipeline|infra)\b/i.test(text)) areas += 1;
  return areas >= 2;
}

/**
 * Rota a mensagem do usuário.
 * @param raw texto original digitado.
 * @param autonomy nível configurado para o repo.
 * @param hasRepo se há repositório aberto (sem repo → conversa pura).
 */
export function routeMessage(raw: string, autonomy: AutonomyLevel, hasRepo: boolean): RouteDecision {
  if (!hasRepo) return { kind: "chat", text: raw, autonomy, agentId: "engineer", useTeam: false, via: "chat" };

  const slash = parseSlash(raw);
  const mention = parseMention(slash.text);
  const text = mention.text || raw;

  // Comando /conversa força bate-papo sem tools.
  if (slash.forceChat) return { kind: "chat", text, autonomy, agentId: mention.agentId ?? "engineer", useTeam: false, via: "slash" };

  // Menção @especialista → tarefa com perfil específico (mesmo em guided).
  if (mention.agentId) {
    const eff = slash.forceExecute ? "full" : slash.forcePlan ? "proposed" : autonomy;
    const canWrite = !!getAgent(mention.agentId)?.skills.includes("write-code");
    return {
      kind: "task",
      text: text || "Atue conforme seu perfil e responda com sua análise.",
      autonomy: eff,
      agentId: mention.agentId,
      // Equipe só quando o perfil mencionado também pode escrever (senão seria
      // um auditor/planejador travado na fase de execução).
      useTeam: canWrite && wantsTeam(mention.agentId, text),
      via: "mention",
    };
  }

  // Comandos /exec (força execução) e /plano (força plano).
  const effAutonomy: AutonomyLevel = slash.forceExecute ? "full" : slash.forcePlan ? "proposed" : autonomy;

  // Comando vazio (ex.: só "/exec") → conversa pedindo context, sem executar no escuro.
  if (!text.trim()) {
    return { kind: "chat", text: "Comando recebido — o que você gostaria que eu fizesse?", autonomy: effAutonomy, agentId: "engineer", useTeam: false, via: "heuristic" };
  }

  // Guided pede comando explícito: sem keyword de tarefa, é conversa.
  const isTaskLike = TASK_HINTS.some((r) => r.test(text));
  if (effAutonomy === "guided" && !isTaskLike) {
    return { kind: "chat", text, autonomy: effAutonomy, agentId: "engineer", useTeam: false, via: "heuristic" };
  }

  // Full executa tarefas automaticamente; letras de conversa ficam em chat.
  if (effAutonomy === "full" && CHAT_HINTS.some((r) => r.test(text)) && !isTaskLike) {
    return { kind: "chat", text, autonomy: effAutonomy, agentId: "engineer", useTeam: false, via: "heuristic" };
  }

  // proposed/full com keyword de tarefa (ou guided com keyword) → executar.
  if (isTaskLike) {
    return {
      kind: "task",
      text,
      autonomy: effAutonomy,
      agentId: "engineer",
      useTeam: wantsTeam("engineer", text),
      via: "heuristic",
    };
  }

  // Sem keyword clara: guided→conversa; proposed→conversa (aguarda pedido); full→tarefa leve.
  if (effAutonomy === "full") {
    return { kind: "task", text, autonomy: effAutonomy, agentId: "engineer", useTeam: wantsTeam("engineer", text), via: "heuristic" };
  }
  return { kind: "chat", text, autonomy: effAutonomy, agentId: "engineer", useTeam: false, via: "heuristic" };
}

/** Lista de comandos para a ajuda embutida. */
export const HELPS: { command: string; desc: string }[] = [
  { command: "@ui/ux", desc: "Foca em interface/visual" },
  { command: "@security", desc: "Foca em segurança" },
  { command: "@pm", desc: "Só planeja (sem editar)" },
  { command: "@review", desc: "Só revisa (sem editar)" },
  { command: "@fullstack", desc: "Trabalha em qualquer área" },
  { command: "/exec", desc: "Força execução agora" },
  { command: "/plano", desc: "Mostra um plano antes de executar" },
  { command: "/conversa", desc: "Só conversa (sem tools)" },
];

export { getAgent };