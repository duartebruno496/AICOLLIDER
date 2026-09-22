import { Buffer } from "buffer";

(globalThis as Record<string, unknown>).Buffer = Buffer;
(globalThis as Record<string, unknown>).process ??= {
  env: { NODE_ENV: import.meta.env.MODE },
} as unknown;