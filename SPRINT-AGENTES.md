# SPRINT-AGENTES — Agentes: conectar no projeto

Plano de implementação fechado. Baseado nas decisões:

- Agentes trabalham **no mesmo projeto aberto** (`activeRepo`), incluindo rascunho `_scratch`.
- Escrita de arquivos: **só no clone local**, com aprovação humana no diff (fluxo atual).
- Leitura: **local (VFS) + remoto via GitHub REST API** (read-only, sem clonar).
- Visão do repo: `listFiles` + `readFile` com **leitura parcial** e **grep virtual**.
- Aprovação de diffs: **fila única** (um diff visível por vez).

## Regra de review (obrigatória em TODO deploy)

Ao terminar cada sprint, ANTES do deploy:

1. **Revisão de código** — tabela de risco (o que pode quebrar, mitigação, status) revisada com o dono.
2. **Revisão de Segurança da Informação (SI)** — checklist abaixo, item a item.
3. Só depois: commit → push → `gh run watch` até success.

### Checklist de revisão de SI

- [ ] **Tokens/segredos**: nunca logados, nunca em query string (só header `Authorization: Bearer`/`onAuth` do isomorphic-git); arrancados de `localStorage` só no mecanismo atual (`aicollider:session`, memória).
- [ ] **Caminhos sanitizados**: rels vindos de upload/clone/agente sem `..`, sem `/` absoluto, sem `\`; escrita sempre dentro do repo (`/${repo}/...`).
- [ ] **URLs restritas**: clone/API só para `github.com`, `api.github.com`, `raw.githubusercontent.com`; CORS proxy com valor fixo conhecido.
- [ ] **Upload**: sem exfiltração — conteúdo importado fica só na VFS/IndexedDB local, nunca enviado a rede; limite de tamanho por arquivo; rejeição de binários (NUL byte).
- [ ] **XSS**: conteúdo nunca renderizado como HTML (Monaco = texto); nomes de arquivo exibidos como texto.
- [ ] **Dados do usuário**: autor/committer forçado (nunca usa a chave/token como autor).
- [ ] **Cota/estabilidade**: limites de nº arquivos por import e tamanho protegem IndexedDB de estouro.

## Sprint 1 — Importar arquivos

**Objetivo:** usuário põe arquivos/pastas do computador dentro do projeto local (ou rascunho), com commit automático.

- [ ] `importFiles` + `existingPaths` + `normalizeImportRel` em `src/lib/fileOps.ts` (batch write + 1 commit + refresh).
- [ ] Sidebar: botão "Importar arquivos" (`<input type="file" multiple>`).
- [ ] Drag & drop de arquivos E pastas (`webkitGetAsEntry`, recursivo) no painel Explorador.
- [ ] Política de colisão (confirma antes de sobrescrever), limite de tamanho (10 MB) e binários (NUL) pulados com aviso.
- [ ] Revisão de código + SI. Deploy.

## Sprint 2 — Agente lê do GitHub (remoto, read-only)

**Objetivo:** o chat/agente consegue olhar repos no GitHub sem clonar (listar, ler arquivos, árvore).

- [ ] `src/lib/githubApi.ts`: `githubListRepo`, `githubGetContents(owner, repo, path, ref)`, `githubGetTree(owner, repo, sha)` com token via `Authorization`, CORS ok.
- [ ] Tools novas `githubListFiles` / `githubReadFile` (branch/ref opcional) — sem aprovação (leitura).
- [ ] Orchestrator executa + prompt orienta uso remoto (sem clone; comparar; branch/PR).
- [ ] Tratamento sem token: retorno amigável.
- [ ] Grep virtual `searchCode(term, path?)` e leitura parcial `readFile(path, from, to)`.
- [ ] Revisão de código + SI. Deploy.

## Sprint 3 — Fila única de diffs

**Objetivo:** equipes/múltiplos agentes propõem mudanças sem conflito de aprovação.

- [ ] `diffGateway` vira fila (`pendingChanges[]`); DiffViewer mostra o primeiro; Aceitar/Rejeitar decide e avança.
- [ ] Agente aguarda a vez (Promise resolve quando o diff dele chega ao topo e é decidido).
- [ ] Indicador no chat: "n diffs na fila" + autor.
- [ ] Revisão de código + SI. Deploy.

## Fora de escopo (pendências abertas)

- Bug WebLLM ("baixa o modelo mas não usa") — investigar separadamente.
- Fase 3 (futura): modelagem de `Skill`/`Agent` e equipe pré-criada no modo agente.