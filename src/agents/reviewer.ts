import type { PendingChange } from "../types";

export interface ReviewVerdict {
  ok: boolean;
  issues: string[];
}

const CODE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "css", "json", "yml", "yaml", "html", "py", "go", "rs", "java", "rb", "sh", "sql", "md", "vue", "svelte"]);

export class ReviewerAgent {
  review(change: PendingChange): ReviewVerdict {
    const issues: string[] = [];
    const ext = change.path.split(".").pop()?.toLowerCase() ?? "";

    if (change.modified.length > 512 * 1024) {
      issues.push("Arquivo proposposto excede 512KB.");
    }
    if (change.path.split("/").some((s) => s === ".." || s === ".")) {
      issues.push("Caminho contém segmentos inválidos ('..').");
    }
    if (CODE_EXTENSIONS.has(ext)) {
      const code = change.modified;
      const imbalance = (open: string, close: string) => {
        const o = (code.match(new RegExp(`\\${open}`, "g")) ?? []).length;
        const c = (code.match(new RegExp(`\\${close}`, "g")) ?? []).length;
        return o - c;
      };
      const delta = imbalance("{", "}");
      if (Math.abs(delta) > 0 && ["ts", "tsx", "js", "jsx", "css", "json", "go", "rs", "java"].includes(ext)) {
        issues.push(`Chaves desbalanceadas ({}=${delta}>0 ? +${delta} : ${delta}).`);
      }
      const paren = imbalance("(", ")");
      if (Math.abs(paren) > 0 && ["ts", "tsx", "js", "jsx"].includes(ext)) {
        issues.push(`Parênteses desbalanceados (${paren > 0 ? "+" : ""}${paren}).`);
      }
      if (ext === "json") {
        try {
          JSON.parse(code);
        } catch {
          issues.push("JSON inválido: não pôde ser parseado.");
        }
      }
      if (ext === "yaml" || ext === "yml") {
        const line = code.split("\n").findIndex((l) => l.trim().length > 0);
        if (line > 0) issues.push("YAML começa com linhas em branco (evite).");
        if (!code.trim()) issues.push("YAML vazio.");
      }
      if (/BEGIN:.+\-/i.test(code)) issues.push("Conteúdo parece conter dados codificados (PEM/base64).");
    }
    if (!change.modified.trim() && change.original.trim()) {
      issues.push("Conteúdo proposto está vazio (arquivo inteiro seria apagado).");
    }
    if (/[^\x09\x0a\x0d\x20-\x7eà-ÿÀ-ß]/u.test(change.modified)) {
      issues.push("Conteúdo contém caracteres não imprimíveis.");
    }

    if (issues.length > 0) {
      return { ok: false, issues };
    }
    return { ok: true, issues: [] };
  }
}