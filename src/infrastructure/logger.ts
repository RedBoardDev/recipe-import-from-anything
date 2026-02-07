import type { LoggerPort } from "../application/ports.js";

class ConsoleLogger implements LoggerPort {
  private readonly level: string;

  constructor(level: string = "info") {
    this.level = level || process.env.LOG_LEVEL || "info";
  }

  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  private formatMessage(message: string, context?: object): string {
    if (context) {
      return `${message} ${JSON.stringify(context)}`;
    }
    return message;
  }

  info(message: string, context?: object): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage(message, context));
    }
  }

  error(message: string, context?: object): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage(message, context));
    }
  }

  warn(message: string, context?: object): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage(message, context));
    }
  }

  debug(message: string, context?: object): void {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage(message, context));
    }
  }
}

export const consoleLogger = new ConsoleLogger();
