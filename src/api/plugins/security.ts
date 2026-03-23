import helmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";
import { registerCors } from "./cors.js";

export async function securityPlugin(instance: FastifyInstance): Promise<void> {
  await registerCors(instance);

  await instance.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: { policy: "require-corp" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: false,
      preload: process.env.NODE_ENV === "production",
    },
    noSniff: true,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
  });
}
