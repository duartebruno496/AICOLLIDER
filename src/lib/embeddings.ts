/**
 * Embeddings reais (provider pago) para o RAG de skills.
 *
 * Quando o usuário configura chave OpenAI, usa `text-embedding-3-small` da
 * OpenAI (cache dos vetores das skills na IndexedDB via store). Sem chave,
 * usa o retrieval local por termos (grátis, sem rede). Sempre aplica fallback
 * seguro: se a chamada de embeddings falhar, volta para o local sem quebrar.
 */
import { SKILL_LIBRARY, retrieveSkills } from "./skills";
import { useAppStore } from "../store/useAppStore";

const EMBED_URL = "https://api.openai.com/v1/embeddings";
const EMBED_MODEL = "text-embedding-3-small";

interface EmbeddingResponse {
  data?: Array<{ embedding: number[] }>;
}

async function fetchEmbedding(text: string): Promise<number[]> {
  const key = useAppStore.getState().apiKeys.openai;
  if (!key) throw new Error("no-openai-key");
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`embedding HTTP ${res.status}`);
  const json = (await res.json()) as EmbeddingResponse;
  const vec = json.data?.[0]?.embedding;
  if (!vec) throw new Error("embedding vazio");
  return vec;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Retrieval híbrido: embeddings (se chave OpenAI) + fallback por termos.
 * @returns lista de ids de skills em ordem de relevância (vazia se nada relevante).
 */
export async function hybridRetrieveSkills(text: string, topN = 3): Promise<string[]> {
  const store = useAppStore.getState();
  const hasKey = Boolean(store.apiKeys.openai);

  if (hasKey) {
    try {
      const cache = store.skillVectors;
      const missing = SKILL_LIBRARY.filter((s) => !cache[s.id]);
      for (const s of missing) {
        try {
          const vec = await fetchEmbedding(`${s.name}\n${s.keywords.join(", ")}`);
          useAppStore.getState().setSkillVector(s.id, vec);
        } catch {
          useAppStore.getState().setSkillVector(s.id, null);
        }
      }
      const queryVec = await fetchEmbedding(text);
      const updated = useAppStore.getState().skillVectors;
      const scored = SKILL_LIBRARY.map((s) => {
        const v = updated[s.id];
        return { id: s.id, score: v ? cosine(queryVec, v) : 0 };
      })
        .filter((x) => x.score > 0.15)
        .sort((a, b) => b.score - a.score);
      if (scored.length > 0) return scored.slice(0, topN).map((x) => x.id);
    } catch {
      // Queda para o retrieval local.
    }
  }
  return retrieveLocal(text, topN);
}

/** Versão local do retrieval (grátis, sem rede) — importada de skills.ts. */
export function retrieveLocal(text: string, topN = 3): string[] {
  return retrieveSkills(text, topN).map((s) => s.id);
}