# ⚡ AICOLLIDER

[![Portátil (ZIP)](https://img.shields.io/badge/Baixar%20port%C3%A1til-ZIP-22c55e?style=for-the-badge)](https://github.com/duartebruno496/AICOLLIDER/releases/download/portable/aicollider-portable.zip)

Assistente de Vibe Coding **multi-plataforma**, 100% client-side.

- **PWA** instalável (Rodar nos navegadores, tablets e pads)
- **Portátil**: baixe o ZIP, descompacte e abra `index.html` para rodar **100% local** (sem servidor, sem hospedagem)
- **Git no navegador** via `isomorphic-git` + `@isomorphic-git/lightning-fs` (IndexedDB, namespace `AicolliderFS`)
- **Sem backend Node.js**. Tudo acontece no navegador do usuário.
- **IA local** via `@mlc-ai/web-llm` (WebGPU/WASM) ou **IA remota** (OpenAI/Anthropic/Gemini) com chaves no `localStorage` (BYOK).

## Rodando

```bash
npm install
npm run icons     # gera os ícones do PWA (public/icons)
npm run dev       # http://localhost:5173
npm run build     # build de produção (typecheck + vite build)
npm run preview
```

## Passos de configuração

1. **Supabase**: crie um projeto no [supabase.com](https://supabase.com), habilite o provider **GitHub** em *Authentication → Providers* (com escopos `repo read:user`) e copie `URL` + `anon key`.
2. Coloque-os em `.env` (veja `.env.example`) **ou** na tela de login/Configurações.
3. `npm run dev` → clique em **"Entrar com GitHub"**.

> ⚠️ O `provider_token` (GitHub Access Token) retornado pelo Supabase é guardado **somente em memória** (Zustand) e usado para autenticar `clone/push/pull`. Também é logado no console.

## Sprints implementados

| Sprint | Escopo |
| --- | --- |
| 1 | Vite + React + TS + Tailwind, PWA (`vite-plugin-pwa`), Supabase, Login GitHub, captura do `provider_token` no estado global |
| 2 | `lightning-fs` + `isomorphic-git` (clone/commit/push/pull/log), sync Kindle-style (Modal), monitor de armazenamento (5GB / alerta 4.5GB) com lixeira |
| 3 | Monaco Editor local (sem CDN), Sidebar com árvore de arquivos, DiffViewer com "Aceitar/Rejeitar" + commit automático |
| 4 | Configurações de chaves (localStorage), `LLMProvider` + factory, provedores remotos (fetch direto) e local (WebLLM/WebGPU), chat |
| 5 | Tools JSON Schema (`listFiles`, `readFile`, `suggestCodeChange`), `Orchestrator`, `CoderAgent`, `ReviewerAgent`, aprovação humana com Promise no DiffViewer |
| 6 | Rollback (`git reset --hard HEAD~1`), guardrails de deploy (Só `.github/workflows/`, proibido SSH/FTP), polimento touch/PWA + ícones |

## Modo Agente (conversa + execução, estilo opencode)

Com um repositório aberto, o chat entende quando você só quer **conversar** e quando você quer uma **tarefa** — sem alternar modos:

- **Autonomia por repositório** (seletor no chat e no Dashboard):
  - `Guided` — o agente só executa com comando explícito ("faça X").
  - `Proposed` (padrão) — detecta a tarefa, apresenta o plano e espera seu OK antes de executar.
  - `Full` — detecta a tarefa e já parte para executar (você aprova cada diff).
- **Especialistas `@`**: `@security`, `@ui/ux`, `@pm`, `@review`, `@fullstack` (e qualquer agente custom). A equipe (PM → executante → Revisor) é acionada pelo roteador quando a tarefa exige múltiplas áreas — sem botão.
- **Comandos**: `/exec` (força execução mesmo em Guided) · `/plano` (mostra plano antes de executar mesmo em Full) · `/conversa` (só conversa, sem tools). Ajuda embutida no chat.
- **RAG de skills**: cada tarefa carrega só as skills relevantes no context (por termos, grátis). Com chave OpenAI configurada, usa embeddings reais no retrieval, com cache local.
- **Configuração aberta**: em Dashboard → Agentes você lista, edita, cria, exclui e exporta/importa agentes e skills (JSON persisted na IndexedDB). Agentes são dados locais — nunca executados como código.

> Toda mudança de arquivo passa por uma aprovação humana (`Aceitar`/`Rejeitar` no diff) — a IA **nunca grava direto**.

## Arquitetura principal

```
src/
  lib/fs.ts            lightning-fs (namespace "AicolliderFS")
  lib/git.ts           Clone/Commit/Push/Pull/Log/Reset + sync checks (http.auth com token)
  lib/workspace.ts     Árvore de arquivos + medição de armazenamento
  lib/llm/             Providers (openai/anthropic/gemini/local-webllm) + factory
  lib/auth.ts          Sessão Supabase + captura do provider_token
  agents/              tools.ts · CoderAgent · ReviewerAgent · Orchestrator · TeamOrchestrator · router.ts (conversa/tarefa/equipe) · registry (perfis+skills) · diffGateway
  store/useAppStore.ts Estado global (Zustand + persist para chaves/config)
```

## Regras de negócio

- A IA **nunca grava direto**: `suggestCodeChange` → DiffViewer → clique humano → `lightning-fs` + commit.
- Deploys geram **apenas** `.github/workflows/*.yml` (nunca SSH/FTP/terminal).
- Ao abrir o repo, o app compara o HEAD local × remoto e sugere sync (fast-forward) antes de codar.
- Armazenamento monitorado (`navigator.storage.estimate`): alerta em 4.5GB, lixeira para excluir clones locais.