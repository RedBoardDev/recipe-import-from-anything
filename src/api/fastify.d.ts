import type { UserId } from "@recipe/domain";

declare module "fastify" {
  interface FastifyRequest {
    userId?: UserId;
  }
}
