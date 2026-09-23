/**
 * Registry de Skills e Agentes (estilo opencode).
 * Uma skill declara: quais tools libera + instruções de uso.
 * Um agente é composto por um conjunto de skills + prompt de papel.
 */

import type { AutonomyLevel } from "../types";
import { useAppStore } from "../store/useAppStore";

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  /** Nomes exatos das tools liberadas por esta skill. */
  allowedTools: string[];
  /** Instruções que entram no system prompt quando a skill está ativa. */
  instructions: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  emoji: string;
  description: string;
  /** Ids das skills que compõem o agente. */
  skills: string[];
  /** Prompt extra específico do papel (comportamento/objetivo). */
  rolePrompt: string;
}

const READ_REPO: AgentSkill = {
  id: "read-repo",
  name: "Leitura do repositório",
  description: "Descobrir a estrutura e ler código do projeto virtual aberto.",
  allowedTools: ["listFiles", "readFile", "searchCode"],
  instructions:
    "Use listFiles para ver a estrutura, readFile para ler arquivos (com from/to para trechos) e searchCode para localizar usos. Nunca invente conteúdo de arquivos que não leu.",
};

const READ_GITHUB: AgentSkill = {
  id: "read-github",
  name: "Leitura de repos remotos",
  description: "Explorar repositórios no GitHub (sem clonar), incl. os do usuário logado.",
  allowedTools: ["githubListFiles", "githubReadFile", "githubListRepos"],
  instructions:
    "Use githubListRepos para ver repositórios da conta logada e githubListFiles/githubReadFile para explorar 'dono/nome' remotos. É leitura apenas; para editar um repo remoto o usuário precisa cloná-lo pela tela de projetos.",
};

const WRITE_CODE: AgentSkill = {
  id: "write-code",
  name: "Escrita com aprovação",
  description: "Propor criação/edição de arquivos (nunca grava direto).",
  allowedTools: ["suggestCodeChange"],
  instructions:
    "suggestCodeChange NUNCA salva direto: um humano clica em 'Aceitar' no diff. Sempre envie o conteúdo COMPLETO do arquivo. Se o humano rejeitar, ajuste a abordagem ou encerre.",
};

const DEPLOY_RULES: AgentSkill = {
  id: "deploy-rules",
  name: "Regras de deploy/infra",
  description: "Guardrails obrigatórios de CI/CD (sem SSH/FTP).",
  allowedTools: [],
  instructions:
    "NUNCA use SSH, FTP, SFTP, rsync, scp ou terminal do SO (ambiente virtual). Para deploy/CI, gere EXCLUSIVAMENTE workflows do GitHub Actions em .github/workflows/ via suggestCodeChange. Padrão válido: actions/checkout@v4, actions/setup-node@v4 (node-version 20), npm ci + npm run build; para Pages html use actions/upload-pages-artifact@v3 e actions/deploy-pages@v4 com permissions contents/pages/id-token e environment github-pages.",
};

export const SKILLS: Record<string, AgentSkill> = {
  "read-repo": READ_REPO,
  "read-github": READ_GITHUB,
  "write-code": WRITE_CODE,
  "deploy-rules": DEPLOY_RULES,
};

/**
 * Skills efetivas: built-in + custom do usuário (custom sobrescreve por id).
 * Acesso via store em tempo real para refletir edições feitas na Configuração.
 */
export function getSkills(): Record<string, AgentSkill> {
  const merged: Record<string, AgentSkill> = { ...SKILLS };
  for (const s of useAppStore.getState().customSkills) {
    if (s && s.id) merged[s.id] = s;
  }
  return merged;
}

export function getSkill(id: string): AgentSkill | undefined {
  return getSkills()[id];
}

/** Tools liberadas por uma lista de skills (com dedupe e ordem estável). */
export function toolsForSkills(skillIds: string[]): string[] {
  const skills = getSkills();
  const out: string[] = [];
  for (const id of skillIds) {
    for (const t of skills[id]?.allowedTools ?? []) {
      if (!out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** Skills-engenheiro = default clássico (ler repo + escrever + regras de deploy). */
const ENGINEER_SKILLS = ["read-repo", "read-github", "write-code", "deploy-rules"];

export const AGENTS: AgentProfile[] = [
  {
    id: "engineer",
    name: "Engenheiro",
    role: "implementação",
    emoji: "👷",
    description: "Executa: planeja, propõe mudanças e espera aprovação no diff.",
    skills: ENGINEER_SKILLS,
    rolePrompt:
      "Você é o Engenheiro sênior de implementação. Decida primeiro: se o usuário está só conversando (saudação, pergunta casual, dúvida), responda de forma conversacional e NÃO use tools de escrita nem crie planos. Se é uma tarefa, comece com 'Plano: ...' listando os passos, use as tools de leitura para entender o projeto e ENTÃO proponha mudanças com suggestCodeChange. Responda de forma objetiva em português.",
  },
  {
    id: "pm",
    name: "PM",
    role: "planejamento",
    emoji: "🧭",
    description: "Estratégico: transforma o pedido em plano sem alterar arquivos.",
    skills: ["read-repo", "read-github", "deploy-rules"],
    rolePrompt:
      "Você é o Product Manager (PM). Decida se a solicitação é uma TAREFA ou uma CONVERSA:\n" +
      "- Se o usuário está só conversando (saudação, pergunta casual, dúvida sem pedido de edição), responda de forma conversacional e amigável. NÃO emita plano, NÃO proponha nada — apenas responda diretamente.\n" +
      "- Só gere um PLANO (ninguém na equipe sai executando sem um plano). A análise sempre começa com 'Plano:' em uma linha separada, depois os passos numerados. Use as tools de leitura para embasar. NÃO pode propor alterações de arquivo nesta fase (você não tem essa tool).",
  },
  {
    id: "reviewer",
    name: "Revisor",
    role: "qualidade",
    emoji: "🔍",
    description: "Valida a implementação contra segurança, clareza e boas práticas.",
    skills: ["read-repo", "read-github", "deploy-rules"],
    rolePrompt:
      "Você é o Revisor de qualidade. Examine o que foi implementado (use tools de leitura), verifique segurança (nada de segredos/SSH/terminal), correção e clareza. Emita veredito final: APROVADO, ou APROVADO com ajustes / REJEITADO com motivos objetivos.",
  },
  {
    id: "uiux",
    name: "UI/UX",
    role: "interface e experiência",
    emoji: "🎨",
    description: "Especialista em interface visual, layout, CSS e experiência do usuário.",
    skills: ["read-repo", "read-github", "write-code", "deploy-rules"],
    rolePrompt:
      "Você é o especialista UI/UX. Foque EXCLUSIVAMENTE em interface, visual, layout, CSS, responsividade, acessibilidade e experiência do usuário. Ignore lógica de negócio/servidor salvo quando o código visual depender dela. Se a tarefa for de outra área, recomende outro agente. Comece com um plano curto, leia o código relevante e proponha mudanças visuais com suggestCodeChange.",
  },
  {
    id: "security",
    name: "Segurança",
    role: "segurança da informação",
    emoji: "🛡️",
    description: "Audita e corrige vulnerabilidades: tokens, injeção, XSS, permissões.",
    skills: ["read-repo", "read-github", "write-code"],
    rolePrompt:
      "Você é o especialista em Segurança da Informação. Audite o projeto procurando vulnerabilidades: exposição de tokens/segredos, injeção (SQL/HTML/script), XSS, SSRF, caminhos arbitrários, permissões excessivas e dependências críticas. Use as tools de leitura para confirmar e proponha correções com suggestCodeChange. Sempre explique o risco de cada achado. Responda em português.",
  },
  {
    id: "fullstack",
    name: "Fullstack",
    role: "todas as áreas",
    emoji: "⚙️",
    description: "Trabalha em qualquer camada: front, back, dados, infra, testes.",
    skills: ["read-repo", "read-github", "write-code", "deploy-rules"],
    rolePrompt:
      "Você é o engenheiro Fullstack. Pode atuar em qualquer camada do projeto (front-end, back-end, dados, infra, testes e docs). Comece com um plano curto, leia o código relevante e proponha mudanças com suggestCodeChange. Responda de forma objetiva em português.",
  },
];

export function getAgent(id: string): AgentProfile | undefined {
  const custom = useAppStore.getState().customAgents.find((a) => a.id === id);
  return custom ?? AGENTS.find((a) => a.id === id);
}

/** Ids dos agentes built-in (para a UI mostrar o que é custom). */
export const BUILTIN_AGENT_IDS: string[] = AGENTS.map((a) => a.id);
export const BUILTIN_SKILL_IDS: string[] = Object.keys(SKILLS);

/** Lista efetiva de agentes: built-in + custom do usuário. */
export function getAgents(): AgentProfile[] {
  const custom = useAppStore.getState().customAgents;
  const byId = new Map<string, AgentProfile>();
  for (const a of AGENTS) byId.set(a.id, a);
  for (const a of custom) if (a && a.id) byId.set(a.id, a);
  return [...byId.values()];
}

/** Regra de autonomia que entra no system prompt do agente executante (Engenheiro). */
export function autonomyRule(level: AutonomyLevel | undefined): string {
  switch (level ?? "proposed") {
    case "guided":
      return "AUTONOMIA (guided): você só executa mudanças quando o USUÁRIO pedir explicitamente (ex.: 'faça', 'crie', 'altere'). Em qualquer outra mensagem, apenas converse e responda — não proponha diffs por conta própria.";
    case "full":
      return "AUTONOMIA (full): ao detectar uma tarefa, você pode ir direto para a execução propondo mudanças com suggestCodeChange (o humano aprova no diff). Para conversas casuais sem pedido de edição, apenas responda.";
    default:
      return "AUTONOMIA (proposed): ao detectar uma tarefa, primeiro apresente um PLANO curto e AGUARDE o usuário aprovar o plano antes de executar com suggestCodeChange. Para conversas casuais sem pedido de edição, apenas responda.";
  }
}