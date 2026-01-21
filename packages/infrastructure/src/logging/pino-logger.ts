import pino, { type Logger as PinoBase, type LoggerOptions } from "pino";
import type { Logger } from "@ria/application";

export class PinoLogger implements Logger {
  constructor(private readonly logger: PinoBase) {}

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.info(meta, message);
      return;
    }

    this.logger.info(message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.warn(meta, message);
      return;
    }

    this.logger.warn(message);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.error(meta, message);
      return;
    }

    this.logger.error(message);
  }
}

export const createPinoLogger = (options?: LoggerOptions): PinoLogger =>
  new PinoLogger(pino(options));
