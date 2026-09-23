# PLANO-AGENTES-V2 — Agente como conversa + execução (estilo opencode)

Redesenho do modo agente a partir das decisões do usuário. Substitui o fluxo atual
(botão "Equipe pré-criada" + histórico inteiro no Engenheiro) por um loop único e adaptativo.

## Decisões fechadas

1. **Propósito**: tudo de programação — projeto novo, manutenção, revisão de código de terceiros. É um projeto de código aberto.
2. **Fluxo**: mistura conversa + execução igual ao opencode. Decisão pode partir do usuário OU do agente, mas **o humano SEMPRE dá a aprovação final** (no diff). Nada é salvo sem OK.
3. **Equipe automática**: NÃO existe botão de habilitação. O roteador decide sozinho quando acionar a equipe e qual perfil usar. Ex.: "só mexer na interface" → agente UI/UX; "segurança" → `@security`.
4. **Autonomia escolhida pelo usuário no início do projeto** (persistida por repo):
   - `guided` — só executa com comando explícito do usuário ("faça X").
   - `proposed` — detecta a tarefa, propõe plano, humano aprova o plano, então executa.
   - `full` — detecta a tarefa e executa direto até os diffs (humano aprova no diff).
5. **IA**: padrão é o provider grátis (OpenRouter :free). O grátis usa retrieval local de skills; quando o usuário configurar chave paga, usa **embeddings reais** para o RAG de skills e tarefas complexas.
6. **Configuração aberta**: tela em Configurações onde o usuário pode ver/editar/criar/exportar/importar agentes e skills (JSON). Projeto aberto → os agentes devem ser extensíveis.
7. **Ajuda de comandos embutida** no chat: exibir como chamar um especialista (`@security`, `@ui/ux`...) e como forçar execução (`/exec`, `/plano`) quando o modo estiver em `guided`/`proposed`.

## Regra de review (obrigatória em TODO deploy)

1. **Revisão de código** — tabela de risco (o que pode quebrar, mitigação, status) revisada com o usuário.
2. **Revisão de SI** — checklist abaixo, item a item.
3. Só depois: commit → push → `gh run watch` até success.

### Checklist de revisão de SI

- [ ] **Tokens/segredos**: nunca logados, nunca em query string (só header `Authorization`).
- [ ] **Caminhos sanitizados**: rels vindos do agente/usuário sem `..`, sem absoluto, sem `\`; escrita sempre dentro do repo.
- [ ] **Escrita restrita**: `write-code` só via diff aprovado; agentes sem a skill não podem escrever (já em runtime).
- [ ] **Prompts/instruções**: scripts de agentes editáveis pelo usuário são dados locais (IndexedDB), nunca executados.
- [ ] **RAG**: conteúdo lido (arquivos locais/remotos) só alimenta contexto local; embeddings paga só quando chave explícita.
- [ ] **XSS**: conteúdo nunca renderizado como HTML.
- [ ] **Cota/estabilidade**: limites no tamanho de contexto de skills (ex.: top-N matches).

## Fase 1 — Autonomia por repositório (Guided / Proposed / Full)

**Objetivo:** o usuário escolhe o nível de autonomia ao abrir/criar o projeto; o loop respeita o nível.

- [x] `types.ts`: `AutonomyLevel = "guided" | "proposed" | "full"`.
- [x] Store: `autonomyByRepo: Record<string, AutonomyLevel>` + `setAutonomy(repo, level)` persistido.
- [x] UI: seletor de autonomia no fluxo de abertura de projeto (Dashboard/abrir repo) + ajuste visível no chat quando repo aberto.
- [x] Prompt base do agente varia com o nível (explica quando pode executar).
- [ ] Revisão de código + SI. Deploy.

## Fase 2 — Loop único: conversa vs tarefa (roteador)

**Objetivo:** sem botão de equipe — um loop decide: conversa, tarefa, agente único ou equipe.

- [x] `src/agents/router.ts`: classifica a mensagem (conversa | tarefa) e escolhe perfil/equipe.
- [x] Menções `@perfil` (ex.: `@security`, `@ui/ux`, `@review`, `@fullstack`) selecionam o agente.
- [x] Comandos `/exec` (força execução em `guided`) e `/plano` (força plano antes de executar em `full`).
- [x] Equipe acionada automaticamente pelo roteador quando a tarefa exige múltiplas áreas; senão agente único.
- [x] Engenheiro de execução recebe SÓ o contexto relevante (plano/perfil), nunca o histórico cru inteiro.
- [x] Ajuda embutida: painel de "Comandos e especialistas" no chat (lista `@...` e `/...`).
- [ ] Revisão de código + SI. Deploy.

## Fase 3 — RAG de skills por agente

**Objetivo:** cada agente carrega só as skills relevantes à tarefa (contexto ~4-8k) + contexto do repo.

- [x] Biblioteca de skills em markdown (`src/agents/skills/` ou `public/skills/`), exportável/importável.
- [x] Retrieval local (escore por termos/fuzzy, sem rede) como padrão grátis.
- [x] Embeddings reais (provider pago) quando houver chave configurada — cache local dos vetores.
- [x] Monta o system prompt: skills relevantes (top-N) + estrutura do repo já conhecida.
- [ ] Revisão de código + SI. Deploy.

## Fase 4 — Configuração de agentes na UI

**Objetivo:** o usuário vê e edita agentes/skills pelas Configurações (código aberto).

- [x] Tela "Agentes" em Configurações: listar, editar (nome, emoji, papel, skills, allowTools, rolePrompt), criar, excluir.
- [x] Exportar/importar JSON de agentes/skills (portabilidade).
- [x] Persistência na IndexedDB + merge com perfis de sync.
- [ ] Revisão de código + SI. Deploy.

## Fase 5 — Pulimento + docs

- [x] Textos do chat (empty state, dicas) apontando comandos/níveis.
- [x] README: como configurar agentes e autonomia (código aberto).
- [ ] Revisão de código + SI. Deploy.

## Fora de escopo (pendências abertas)

- Bug WebLLM ("baixa o modelo mas não usa") — investigar separadamente.
- Suporte a comandos do projeto (rodar build/test dentro do agente) — decisão futura.
- Memória persistente entre sessões (histórico de decisões) — decisão futura.

## Como testar (fumaça por fase)

- [F1] Abrir dois projetos → níveis diferentes persistidos; `guided` não executa sem comando; `proposed` mostra plano primeiro; `full` vai direto ao diff.
- [F2] "oi" → só conversa. "Crie um readme" → executa. "mexer só na interface" → perfil UI/UX. "vê se tá seguro" → `@security`. Equipe aparece sem botão quando necessário.
- [F3] Skills certas no contexto (mensagem sobre CSS não carrega skill de deploy).
- [F4] Editar/criar/exportar agente nas Configurações reflete no comportamento.
