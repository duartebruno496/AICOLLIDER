import { db } from "./db";
import type { ChatMessage } from "../types";

const TABLE = "chat";

/** Histórico do vibe-chat é salvo por projeto (chave = nome do diretório). */
export async function loadChat(repo: string): Promise<ChatMessage[]> {
  return (await db.get<ChatMessage[]>(TABLE, repo)) ?? [];
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveChatDebounced(repo: string, chat: ChatMessage[]): void {
  if (saveTimer !== null) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void db
      .set(TABLE, repo, chat)
      .then(() => db.flush())
      .catch(() => undefined);
  }, 250);
}