import { db } from "./db";

export interface RepoMeta {
  repositoryUrl: string | null;
  createdAt: number;
  lastOpenedAt: number;
}

const TABLE = "repoMeta";

/** Metadados por projeto (ex.: origem remota, criado/última abertura). */
export async function saveRepoMeta(dir: string, meta: Partial<RepoMeta>): Promise<void> {
  const prev = (await db.get<RepoMeta>(TABLE, dir)) ?? { repositoryUrl: null, createdAt: Date.now(), lastOpenedAt: Date.now() };
  await db.set(TABLE, dir, { ...prev, ...meta, lastOpenedAt: Date.now() });
}

export async function loadRepoMeta(dir: string): Promise<RepoMeta | undefined> {
  return db.get<RepoMeta>(TABLE, dir);
}