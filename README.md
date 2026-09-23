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

## Arquitetura principal

```
src/
  lib/fs.ts            lightning-fs (namespace "AicolliderFS")
  lib/git.ts           Clone/Commit/Push/Pull/Log/Reset + sync checks (http.auth com token)
  lib/workspace.ts     Árvore de arquivos + medição de armazenamento
  lib/llm/             Providers (openai/anthropic/gemini/local-webllm) + factory
  lib/auth.ts          Sessão Supabase + captura do provider_token
  agents/              tools.ts · CoderAgent · ReviewerAgent · Orchestrator · diffGateway
  store/useAppStore.ts Estado global (Zustand + persist para chaves/config)
```

## Regras de negócio

- A IA **nunca grava direto**: `suggestCodeChange` → DiffViewer → clique humano → `lightning-fs` + commit.
- Deploys geram **apenas** `.github/workflows/*.yml` (nunca SSH/FTP/terminal).
- Ao abrir o repo, o app compara o HEAD local × remoto e sugere sync (fast-forward) antes de codar.
- Armazenamento monitorado (`navigator.storage.estimate`): alerta em 4.5GB, lixeira para excluir clones locais.