/**
 * Registry de Skills e Agentes (estilo opencode).
 * Uma skill declara: quais tools libera + instruções de uso.
 * Um agente é composto por um conjunto de skills + prompt de papel.
 */

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

/** Tools liberadas por uma lista de skills (com dedupe e ordem estável). */
export function toolsForSkills(skillIds: string[]): string[] {
  const out: string[] = [];
  for (const id of skillIds) {
    for (const t of SKILLS[id]?.allowedTools ?? []) {
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
];

export function getAgent(id: string): AgentProfile | undefined {
  return AGENTS.find((a) => a.id === id);
}