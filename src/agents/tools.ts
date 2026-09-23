import type { LLMToolDef } from "../lib/llm/types";

export const TOOLS: LLMToolDef[] = [
  {
    type: "function",
    function: {
      name: "listFiles",
      description:
        "Lista os arquivos e pastas do repositório virtual atualmente aberto. Use para descobrir a estrutura do projeto antes de ler ou alterar arquivos.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho opcional dentro do repositório (ex.: 'src', 'src/components'). Vazio lista a raiz.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readFile",
      description:
        "Lê o conteúdo atual de um arquivo dentro do repositório virtual e o retorna como texto. Use 'from'/'to' (linhas, 1-based) para ler apenas um trecho e economizar contexto.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho do arquivo dentro do repositório (ex.: 'src/App.tsx', 'README.md').",
          },
          from: {
            type: "number",
            description: "Linha inicial (opcional, 1-based).",
          },
          to: {
            type: "number",
            description: "Linha final (opcional).",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchCode",
      description:
        "Busca um termo em TODOS os arquivos de texto do projeto aberto (ignora node_modules, dist, .git etc.) e retorna ocorrências no formato arquivo:linha: trecho. Use para localizar onde algo é usado/definido antes de ler o arquivo.",
      parameters: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description: "Termo a buscar (case-insensitive).",
          },
          path: {
            type: "string",
            description: "Pasta opcional para limitar a busca (ex.: 'src').",
          },
        },
        required: ["term"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "githubListFiles",
      description:
        "Lista a árvore de arquivos de um repositório NO GITHUB (sem clonar). Use para explorar repos remotos, branches ou PRs. Exige login no GitHub.",
      parameters: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "Repositório no formato 'dono/nome' (ex.: 'facebook/react').",
          },
          ref: {
            type: "string",
            description: "Branch, tag ou SHA opcional (padrão: branch principal).",
          },
        },
        required: ["repo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "githubReadFile",
      description:
        "Lê o conteúdo texto de um arquivo de um repositório NO GITHUB (sem clonar). Exige login no GitHub. Limite da API: até 1 MB por arquivo.",
      parameters: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "Repositório no formato 'dono/nome' (ex.: 'facebook/react').",
          },
          path: {
            type: "string",
            description: "Caminho do arquivo no repo remoto (ex.: 'src/App.js').",
          },
          ref: {
            type: "string",
            description: "Branch, tag ou SHA opcional (padrão: branch principal).",
          },
        },
        required: ["repo", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggestCodeChange",
      description:
        "PROPOSTA uma criação ou alteração de arquivo. A mudança NÃO é salva até o usuário humano aprovar o diff. Use o conteúdo COMPLETO do arquivo, nunca trechos.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho relativo do arquivo a criar/alterar (ex.: 'README.md', 'src/hello.ts').",
          },
          content: {
            type: "string",
            description: "Conteúdo NOVO e completo do arquivo.",
          },
          reason: {
            type: "string",
            description: "Breve explicação do porquê desta mudança.",
          },
        },
        required: ["path", "content"],
      },
    },
  },
];

export function toolResult(reason: string, ok: boolean) {
  return ok ? `OK: ${reason}` : `FALHOU: ${reason}`;
}