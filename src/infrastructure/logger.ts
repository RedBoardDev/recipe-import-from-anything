import type { LoggerPort } from "../application/ports.js";

const SENSITIVE_PATTERNS = [
  // Common secret keys
  /secret\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /password\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /token\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /api[_-]?key\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /private[_-]?key\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,

  // Authorization headers
  /authorization\s*:\s*bearer\s+[a-z0-9\-._~+/]+=*/gi,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,

  // Specific environment variables
  /JWT_SECRET\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /API_KEY\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /DATABASE_URL\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
  /REDIS_URL\s*[:=]\s*["']?([^"'\s,}]+)["']?/gi,
];

function redactSensitive(message: string): string {
  let redacted = message;

  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }

  return redacted;
}

function redactObject(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item));
  }

  const result: Record<string, unknown> = {};
  const sensitiveKeys = [
    "secret",
    "password",
    "token",
    "apiKey",
    "api_key",
    "privateKey",
    "private_key",
    "jwt",
    "authorization",
    "cookie",
  ];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redactObject(value);
    }
  }

  return result;
}

/**
 * Console logger with sensitive data redaction
 */
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
    const redactedMessage = redactSensitive(message);
    if (context) {
      const redactedContext = redactObject(context);
      return `${redactedMessage} ${JSON.stringify(redactedContext)}`;
    }
    return redactedMessage;
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
