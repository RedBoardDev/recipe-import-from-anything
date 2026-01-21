import { promises as fs } from "node:fs";
import { resolve, dirname, isAbsolute, sep, normalize as normalizePath } from "node:path";
import type { ArtifactStore } from "@ria/application";

export interface FileArtifactStoreOptions {
  baseDir: string;
}

const ensureSafeKey = (key: string): string => {
  const normalized = normalizePath(key).replace(/^\.+[\/]+/, "");

  if (isAbsolute(normalized) || normalized.startsWith("..")) {
    throw new Error("Invalid artifact key");
  }

  return normalized.replace(/^[/\\]+/, "");
};

export class FileArtifactStore implements ArtifactStore {
  private readonly baseDir: string;

  constructor(options: FileArtifactStoreOptions) {
    this.baseDir = resolve(options.baseDir);
  }

  async put(key: string, data: string | Buffer, _contentType: string): Promise<string> {
    const safeKey = ensureSafeKey(key);
    const targetPath = resolve(this.baseDir, safeKey);

    if (!targetPath.startsWith(this.baseDir + sep)) {
      throw new Error("Artifact path escapes base directory");
    }

    await fs.mkdir(dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, data);

    return `file://${targetPath}`;
  }
}
