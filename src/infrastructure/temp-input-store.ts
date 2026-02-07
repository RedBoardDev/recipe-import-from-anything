import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TempInputStore } from "@recipe/pipeline-contracts";

export class FileTempInputStore implements TempInputStore {
  private readonly basePath: string;

  constructor(basePath: string = "./tmp/inputs") {
    this.basePath = basePath;
  }

  async save(data: Buffer): Promise<string> {
    if (!existsSync(this.basePath)) {
      await mkdir(this.basePath, { recursive: true });
    }

    const filename = `${randomUUID()}.bin`;
    const filePath = join(this.basePath, filename);
    await writeFile(filePath, data);
    return filePath;
  }

  async get(ref: string): Promise<Buffer | null> {
    try {
      return await readFile(ref);
    } catch {
      return null;
    }
  }

  async delete(ref: string): Promise<void> {
    try {
      await unlink(ref);
    } catch {
      // Ignore errors
    }
  }
}

export const tempInputStore = new FileTempInputStore(process.env.TEMP_INPUTS_PATH || "./tmp/inputs");
