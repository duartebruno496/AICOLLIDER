/**
 * Biblioteca de Skills para o RAG (retrieval por relevância).
 *
 * Cada skill tem um texto markdown em `content` (instruções ricas para o
 * agente) e uma lista de `keywords` (termos de busca). O motor de retrieval
 * calcula um escore simples por ocorrência de keywords no texto da tarefa e
 * no nome/estrutura do repositório; embeddings reais (provider pago) são
 * opcionais e usados como complemento quando há chave.
 */

export interface SkillDoc {
  id: string;
  name: string;
  /** Entra no system prompt quando a skill é recuperada. */
  content: string;
  /** Termos que disparam esta skill (case-insensitive, substrings). */
  keywords: string[];
}

export const SKILL_LIBRARY: SkillDoc[] = [
  {
    id: "frontend-css",
    name: "Interface e CSS",
    keywords: ["css", "ui", "ux", "interface", "tela", "layout", "responsivo", "responsive", "visual", "design", "componente", "react", "html", "style", "styles", "color", "cor", "font", "fonte", "tema", "theme"],
    content: `## Skill: Interface, CSS e UX
- Prefira classes utilitárias simples e contraste legível (texto claro em fundo escuro).
- Mantenha responsividade (mobile-first) e toque (touch-manipulation, min-h para alvos).
- Não quebre o tema existente do projeto para fazer a mudança; siga os patterns do próprio repo.
- Verifique o arquivo correto antes de alterar (pode haver .css, styled-components, tailwind).`,
  },
  {
    id: "security-audit",
    name: "Segurança da IA",
    keywords: ["segur", "security", "vulner", "token", "segredo", "secret", "xss", "sql", "inje", "injection", "ssh", "senha", "password", "api key", "chave"],
    content: `## Skill: Segurança da Informação
- NUNCA coloque tokens/segredos em query string ou log; use header Authorization.
- Sanitize caminhos: sem '..', sem absoluto, sem '\\'; escrita sempre dentro do repo.
- Desconfie de conteúdo renderizado como HTML (risco XSS); prefira texto/puro ou escape.
- NUNCA proponha uso de SSH/FTP/rsync/scp/terminal; deploy = GitHub Actions (arquivos .github/workflows).
- Ao revisar, liste riscos concretos (arquivo:trecho) e proponha correção.`,
  },
  {
    id: "git-github",
    name: "Git e GitHub",
    keywords: ["git", "github", "commit", "branch", "pr", "pull", "push", "clone", "repo", "remoto", "remote"],
    content: `## Skill: Git e GitHub
- Repos remotos são lidos via API (githubListFiles/githubReadFile/githubListRepos), sem clonar.
- Alterações locais são commits do repositório virtual; o humano aprova no diff antes.
- Não duplique histórico: proponha mudanças pequenas e focadas, nunca reescreva o repositório inteiro.`,
  },
  {
    id: "deploy-infra",
    name: "Deploy e Infra",
    keywords: ["deploy", "ci", "cd", "workflow", "pipeline", "github actions", "pages", "infra", "servidor", "server", "build", "publicar", "publicar site"],
    content: `## Skill: Deploy e Infra (regras restritas)
- NUNCA use SSH/FTP/SFTP/rsync/scp ou terminal do SO (ambiente virtual).
- Para deploy/CI, gere EXCLUSIVAMENTE arquivos de workflow em .github/workflows/ via suggestCodeChange.
- Padrão válido: actions/checkout@v4, actions/setup-node@v4 (node-version 24), npm ci + npm run build;
  para Pages html use actions/upload-pages-artifact@v3 + actions/deploy-pages@v4 com permissions pages/id-token/write e environment github-pages.`,
  },
  {
    id: "typescript-react",
    name: "TypeScript e React",
    keywords: ["typescript", "ts", "react", "hook", "hook", "component", "props", "state", "jsx", "tsx", ".tsx", ".ts ", "tipagem", "type", "interface ts"],
    content: `## Skill: TypeScript / React
- Respeite os tipos existentes; adicione novos tipos em src/types.ts quando necessário.
- Evite 'any'. Prefira tipos explícitos e literais pequenos.
- Hooks: respeite regras (não em condicionais/loops); use useCallback/useMemo só quando necessário.
- Nomes em inglês para código; mensagens de UI podem ficar em português (padrão do projeto).`,
  },
  {
    id: "node-backend",
    name: "Node, APIs e dados",
    keywords: ["node", "api", "endpoint", "backend", "server", "banco", "database", "db", "sql", "json", "rest", "fetch", "rotas", "route"],
    content: `## Skill: Node / APIs / dados
- Sempre confirme entradas externas (valide tipos e limites) antes de usar.
- Não exponha segredos do servidor ao cliente (ex.: só o que o front precisa).
- APIs de terceiros: use URL fixa conhecida e trate erro de rede com mensagem amigável.
- Prefira funções pequenas e testáveis; trate erros (try/catch) e devolva mensagens claras.`,
  },
  {
    id: "testing-debug",
    name: "Testes e debug",
    keywords: ["test", "teste", "bug", "erro", "error", "crash", "debbug", "depurar", "debug", "console", "log", "exception"],
    content: `## Skill: Testes e depuração
- Antes de corrigir, leia o código relevante e reproduza mentalmente o fluxo (use searchCode/readFile).
- Não remova logs/debug de outras pessoas sem avisar na descrição da mudança.
- Proponha mudanças pequenas e verificáveis; explique o que foi corrigido.`,
  },
  {
    id: "docs-content",
    name: "Documentação e conteúdo",
    keywords: ["readme", "document", "docs", "doc", "md", "markdown", "conteudo", "conteúdo", "texto", "artigo"],
    content: `## Skill: Documentação
- README/artigos em markdown: título claro, seções curtas, exemplos funcionais.
- Não invente APIs ou comandos que não existem no projeto; confirme no código.
- Escreva para colaboradores de projeto aberto (código de conduta, como rodar, como contribuir).`,
  },
];

/** Recupera as skills mais relevantes para um texto (retrieval local, sem rede). */
export function retrieveSkills(text: string, topN = 3): SkillDoc[] {
  const t = text.toLowerCase();
  const scored = SKILL_LIBRARY.map((s) => {
    let score = 0;
    for (const kw of s.keywords) {
      if (t.includes(kw.toLowerCase())) score += 1;
    }
    // Bônus claro para match exato do id.
    if (t.includes(s.id.replace(/-/g, " "))) score += 2;
    return { skill: s, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN).map((x) => x.skill);
}

/**
 * Monta a seção de skills do system prompt a partir dos ids recuperados.
 * Sem rede por padrão (retrieval por termos); embeddings opcionais usam
 * hybridRetrieveSkills em lib/embeddings.ts.
 */
export function buildSkillsSection(agentId: string, ids: string[]): string {
  const docs: SkillDoc[] = [];
  for (const id of ids) {
    const d = SKILL_LIBRARY.find((s) => s.id === id);
    if (d) docs.push(d);
  }
  if (docs.length === 0) return "";
  const body = docs.map((s) => s.content).join("\n\n");
  return `\n\nVocê resolveu usar estas skills (relevant retrieval) para a tarefa:\n${body}`;
}