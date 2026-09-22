import { readFile, writeFile } from "./fs";

/**
 * Mini DB JSON sobre o lightining-fs (IndexedDB).
 *
 * Funciona como "sqlite do navegador": os módulos .ts leem/gravam estado
 * estruturado (tabela -> chave -> valor JSON tipado), 100% offline,
 * persistido no arquivo `/.aicollider/db.json`.
 */

const DB_PATH = "/.aicollider/db.json";

type DbShape = Record<string, Record<string, unknown>>;

type Row<T> = { key: string; value: T };

let cache: DbShape | null = null;

async function load(): Promise<DbShape> {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(await readFile(DB_PATH)) as DbShape;
    cache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function sanitize(part: string): string {
  return part.replace(/[./\\]/g, "_");
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function schedulePersist() {
  if (writeTimer !== null) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    const snapshot = JSON.stringify(cache ?? {});
    writeChain = writeChain
      .then(() => writeFile(DB_PATH, snapshot))
      .catch(() => {
        /* se fallhar, tenta de novo na próxima gravação */
      });
  }, 120);
}

export const db = {
  schema<T>(table: string) {
    const t = sanitize(table);
    return {
      get: (key: string) => db.get<T>(t, key),
      all: () => db.all<T>(t),
      set: (key: string, value: T) => db.set(t, key, value),
      remove: (key: string) => db.remove(t, key),
    };
  },

  async get<T>(table: string, key: string): Promise<T | undefined> {
    const data = await load();
    const row = data[sanitize(table)]?.[sanitize(key)];
    return row as T | undefined;
  },

  async set<T>(table: string, key: string, value: T): Promise<void> {
    const data = await load();
    (data[sanitize(table)] ??= {})[sanitize(key)] = value;
    schedulePersist();
  },

  async all<T>(table: string): Promise<Row<T>[]> {
    const data = await load();
    const rows = data[sanitize(table)] ?? {};
    return Object.entries(rows).map(([key, value]) => ({ key, value: value as T }));
  },

  async remove(table: string, key: string): Promise<void> {
    const data = await load();
    delete data[sanitize(table)]?.[sanitize(key)];
    schedulePersist();
  },

  async clear(table: string): Promise<void> {
    const data = await load();
    delete data[sanitize(table)];
    schedulePersist();
  },

  /** Força a gravação pendente (usar antes de sair/descarregar). */
  async flush(): Promise<void> {
    if (writeTimer !== null) {
      clearTimeout(writeTimer);
      writeTimer = null;
      const snapshot = JSON.stringify(cache ?? {});
      writeChain = writeChain
        .then(() => writeFile(DB_PATH, snapshot))
        .catch(() => undefined);
    }
    await writeChain;
  },
};