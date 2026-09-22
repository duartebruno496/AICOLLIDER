import LightningFS from "@isomorphic-git/lightning-fs";

const FS_NAMESPACE = "AicolliderFS";

let _fs: InstanceType<typeof LightningFS> | null = null;

export function getFS(): InstanceType<typeof LightningFS> {
  if (!_fs) {
    const Ctor = (LightningFS as unknown as { default?: typeof LightningFS }).default ?? LightningFS;
    _fs = new Ctor(FS_NAMESPACE, { wipe: false });
  }
  return _fs;
}

export const VFS = getFS();

export interface FsEntry {
  path: string;
  name: string;
  kind: "file" | "dir";
}

export async function readDir(path: string): Promise<FsEntry[]> {
  try {
    const entries = (await VFS.promises.readdir(path)) as string[];
    const out: FsEntry[] = [];
    for (const name of entries) {
      const full = path === "/" ? `/${name}` : `${path}/${name}`;
      const stat = await VFS.promises.stat(full);
      out.push({
        path: full,
        name,
        kind: stat.isDirectory() ? "dir" : "file",
      });
    }
    out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return out;
  } catch {
    return [];
  }
}

export async function readFile(path: string): Promise<string> {
  try {
    const buf = (await VFS.promises.readFile(path)) as Uint8Array;
    return new TextDecoder().decode(buf);
  } catch (err) {
    throw new Error(`Falha ao ler ${path}: ${String(err)}`);
  }
}

export async function writeFile(path: string, content: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  let acc = "";
  for (let i = 0; i < parts.length - 1; i++) {
    acc += `/${parts[i]}`;
    try {
      await VFS.promises.stat(acc);
    } catch {
      await VFS.promises.mkdir(acc);
    }
  }
  await VFS.promises.writeFile(path, new TextEncoder().encode(content));
}

export async function deletePath(path: string): Promise<void> {
  const stat = await VFS.promises.stat(path);
  if (stat.isDirectory()) {
    const rm = (VFS.promises as unknown as Record<string, (p: string, o: { recursive?: boolean }) => Promise<void>>).rm;
    if (rm) await rm(path, { recursive: true });
    else await (VFS.promises as unknown as { rmdir: (p: string) => Promise<void> }).rmdir(path);
  } else {
    await VFS.promises.unlink(path);
  }
}

export async function listTopLevelDirs(): Promise<string[]> {
  const entries = await readDir("/");
  return entries
    .filter((e) => e.kind === "dir" && !e.name.startsWith("."))
    .map((e) => e.name);
}