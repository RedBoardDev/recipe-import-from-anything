import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TempInputStore } from "@recipe/pipeline-contracts";

const MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const FILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ManagedFileTempInputStore implements TempInputStore {
  private readonly basePath: string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(basePath: string = "./tmp/inputs") {
    this.basePath = basePath;
    this.startCleanup();
  }

  async save(data: Buffer): Promise<string> {
    await this.ensureBasePathExists();
    await this.validateSize(data);

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

  /**
   * Clean up old files
   */
  async cleanup(): Promise<void> {
    if (!existsSync(this.basePath)) {
      return;
    }

    const now = Date.now();
    const files = await readdir(this.basePath);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = join(this.basePath, file);
      try {
        const stats = await stat(filePath);
        if (now - stats.mtimeMs > FILE_TTL_MS) {
          await unlink(filePath);
          deletedCount++;
        }
      } catch {
        // Ignore errors
      }
    }

    if (deletedCount > 0) {
      // Log cleanup result if needed
      console.debug(`[TempInputStore] Cleaned up ${deletedCount} old files`);
    }
  }

  /**
   * Destroy the store and stop cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private async ensureBasePathExists(): Promise<void> {
    if (!existsSync(this.basePath)) {
      await mkdir(this.basePath, { recursive: true });
    }
  }

  private async validateSize(data: Buffer): Promise<void> {
    const currentSize = await this.getCurrentSize();
    if (currentSize + data.length > MAX_TOTAL_SIZE) {
      throw new Error(`Temp input store size limit exceeded: ${currentSize + data.length} > ${MAX_TOTAL_SIZE}`);
    }
  }

  private async getCurrentSize(): Promise<number> {
    if (!existsSync(this.basePath)) {
      return 0;
    }

    let totalSize = 0;
    const files = await readdir(this.basePath);

    for (const file of files) {
      const filePath = join(this.basePath, file);
      try {
        const stats = await stat(filePath);
        totalSize += stats.size;
      } catch {
        // Ignore errors
      }
    }

    return totalSize;
  }

  private startCleanup(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch((error) => {
        console.error("[TempInputStore] Cleanup error:", error);
      });
    }, CLEANUP_INTERVAL_MS);

    // Run initial cleanup after a short delay
    setTimeout(() => {
      this.cleanup().catch((error) => {
        console.error("[TempInputStore] Initial cleanup error:", error);
      });
    }, 5000);
  }
}

/**
 * Singleton instance
 */
export const tempInputStore = new ManagedFileTempInputStore(process.env.TEMP_INPUTS_PATH || "./tmp/inputs");
