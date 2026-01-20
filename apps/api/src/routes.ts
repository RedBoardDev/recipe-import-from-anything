import type { FastifyInstance } from "fastify";
import type { ImportJob, ImportResult } from "@ria/domain";
import type { CreateJobFromText, CreateJobFromUrl, GetJob, GetResult } from "@ria/application";
import { importFromTextSchema, importFromUrlSchema, importOptionsSchema } from "./schemas";

export interface ApiDependencies {
  createJobFromUrl: CreateJobFromUrl;
  createJobFromText: CreateJobFromText;
  getJob: GetJob;
  getResult: GetResult;
}

const requireUserId = async (request: { headers: Record<string, unknown>; userId?: string }, reply: { status: (code: number) => { send: (payload: unknown) => void } }): Promise<void> => {
  const header = request.headers["x-user-id"];
  const userId = Array.isArray(header) ? header[0] : header;

  if (!userId || typeof userId !== "string") {
    reply.status(401).send({ error: "missing_user_id" });
    return;
  }

  request.userId = userId;
};

const assertOwnership = (job: ImportJob, userId: string): void => {
  if (job.userId !== userId) {
    throw new Error("forbidden");
  }
};

export const registerRoutes = async (
  app: FastifyInstance,
  deps: ApiDependencies
): Promise<void> => {
  const authPreHandler = async (request: any, reply: any) => {
    await requireUserId(request, reply);
  };

  app.post("/v1/import/from-url", { preHandler: authPreHandler }, async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "missing_user_id" });
    }

    const payload = importFromUrlSchema.parse(request.body);
    const options = importOptionsSchema.parse(payload.options);

    const job = await deps.createJobFromUrl.execute({
      userId: request.userId,
      url: payload.url,
      options
    });

    return reply.send({ jobId: job.id });
  });

  app.post("/v1/import/from-text", { preHandler: authPreHandler }, async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "missing_user_id" });
    }

    const payload = importFromTextSchema.parse(request.body);
    const options = importOptionsSchema.parse(payload.options);

    const job = await deps.createJobFromText.execute({
      userId: request.userId,
      text: payload.text,
      options
    });

    return reply.send({ jobId: job.id });
  });

  app.get("/v1/jobs/:id", { preHandler: authPreHandler }, async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "missing_user_id" });
    }

    const { id } = request.params as { id: string };
    const job = await deps.getJob.execute({ jobId: id });
    if (!job) {
      return reply.status(404).send({ error: "not_found" });
    }

    try {
      assertOwnership(job, request.userId);
    } catch {
      return reply.status(403).send({ error: "forbidden" });
    }

    return reply.send({
      id: job.id,
      status: job.status,
      progressPct: job.progressPct,
      currentStep: job.currentStep,
      warnings: job.warnings,
      errors: job.errors
    });
  });

  app.get("/v1/jobs/:id/result", { preHandler: authPreHandler }, async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: "missing_user_id" });
    }

    const { id } = request.params as { id: string };
    const job = await deps.getJob.execute({ jobId: id });
    if (!job) {
      return reply.status(404).send({ error: "not_found" });
    }

    try {
      assertOwnership(job, request.userId);
    } catch {
      return reply.status(403).send({ error: "forbidden" });
    }

    if (job.status !== "SUCCEEDED") {
      return reply.status(409).send({ error: "job_not_succeeded" });
    }

    const result: ImportResult | null = await deps.getResult.execute({ jobId: job.id });
    if (!result) {
      return reply.status(404).send({ error: "result_not_found" });
    }

    return reply.send(result);
  });
};
