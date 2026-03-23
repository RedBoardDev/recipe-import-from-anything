import cors, { type FastifyCorsOptions } from "@fastify/cors";
import type { FastifyInstance } from "fastify";

const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;
const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "OPTIONS"] as const;
const DEFAULT_ALLOWED_HEADERS = ["content-type", "authorization", "x-user-id", "idempotency-key"] as const;

const splitCommaSeparatedValues = (value: string): readonly string[] => {
  const parsedValues = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsedValues.length > 0 ? parsedValues : DEFAULT_ALLOWED_ORIGINS;
};

export const getCorsOptions = (): FastifyCorsOptions => {
  const allowedOrigins = new Set(
    process.env.CORS_ALLOWED_ORIGINS
      ? splitCommaSeparatedValues(process.env.CORS_ALLOWED_ORIGINS)
      : DEFAULT_ALLOWED_ORIGINS,
  );

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, false);
        return;
      }

      callback(null, allowedOrigins.has(origin));
    },
    methods: [...DEFAULT_ALLOWED_METHODS],
    allowedHeaders: [...DEFAULT_ALLOWED_HEADERS],
    optionsSuccessStatus: 204,
    preflightContinue: false,
  };
};

export async function registerCors(server: FastifyInstance): Promise<void> {
  await server.register(cors, getCorsOptions());
}
