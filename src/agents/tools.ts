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
        "Lê o conteúdo atual de um arquivo dentro do repositório virtual e o retorna como texto.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho do arquivo dentro do repositório (ex.: 'src/App.tsx', 'README.md').",
          },
        },
        required: ["path"],
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