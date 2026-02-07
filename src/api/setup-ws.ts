import websocket from "@fastify/websocket";
import { JobId, type UserId } from "@recipe/domain";
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import type { AuthPort, EventBridgePort } from "../application/ports.js";
import type { GetJobStatusResult } from "../application/use-cases.js";
import { ERROR_CODES } from "./errors/error-codes.js";
import { formatError, formatSuccess } from "./helpers/response-format.js";

const authMessageSchema = z.object({
  type: z.literal("auth"),
  headers: z.record(z.string()).optional(),
});

const subscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  jobId: z.string().trim().min(1),
});

const unsubscribeMessageSchema = z.object({
  type: z.literal("unsubscribe"),
  jobId: z.string().trim().min(1),
});

const pingMessageSchema = z.object({
  type: z.literal("ping"),
});

const wsMessageSchema = z.discriminatedUnion("type", [
  authMessageSchema,
  subscribeMessageSchema,
  unsubscribeMessageSchema,
  pingMessageSchema,
]);

type WsMessage = z.infer<typeof wsMessageSchema>;
type JobSnapshotFetcher = (jobId: JobId) => Promise<GetJobStatusResult | null>;

type WebSocketConnection = {
  userId: UserId | null;
  socket: WebSocket;
  subscriptions: Map<string, (data: object) => void>;
};

export type WebSocketRoutesOptions = Readonly<{
  authPort: AuthPort;
  eventBridge: EventBridgePort;
  getJobSnapshot: JobSnapshotFetcher;
}>;

const parseMessage = (rawMessage: Buffer): WsMessage => {
  const parsedJson: unknown = JSON.parse(rawMessage.toString());
  const parsedMessage = wsMessageSchema.safeParse(parsedJson);
  if (!parsedMessage.success) {
    throw new Error("Invalid message format");
  }
  return parsedMessage.data;
};

const sendJson = (socket: WebSocket, data: unknown): void => {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(data));
};

export const websocketRoutes: FastifyPluginAsync<WebSocketRoutesOptions> = async (server, options) => {
  await server.register(websocket, { options: { maxPayload: 1_048_576 } });

  const connections = new Map<string, WebSocketConnection>();

  server.get("/ws", { websocket: true }, (socket) => {
    const connectionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const subscriptions = new Map<string, (data: object) => void>();
    const connection: WebSocketConnection = {
      userId: null,
      socket,
      subscriptions,
    };

    connections.set(connectionId, connection);

    const cleanupConnection = (): void => {
      if (connection.userId) {
        for (const [jobId, send] of subscriptions.entries()) {
          options.eventBridge.removeSubscription(new JobId(jobId), connection.userId, send);
        }
      }
      subscriptions.clear();
      connections.delete(connectionId);
    };

    socket.on("message", async (rawMessage: Buffer) => {
      try {
        const message = parseMessage(rawMessage);

        if (!connection.userId) {
          if (message.type !== "auth") {
            sendJson(socket, formatError(ERROR_CODES.UNAUTHORIZED, { details: "Must authenticate first" }));
            return;
          }

          try {
            const result = await options.authPort.authenticate({
              headers: message.headers ?? {},
            });
            connection.userId = result.userId;
            sendJson(socket, formatSuccess({ type: "auth.success" }));
          } catch {
            sendJson(socket, formatError(ERROR_CODES.UNAUTHORIZED, { details: "WebSocket auth failed" }));
            socket.close();
          }
          return;
        }

        if (message.type === "subscribe") {
          if (!subscriptions.has(message.jobId)) {
            const send = (data: object) => {
              if (!subscriptions.has(message.jobId)) {
                return;
              }
              sendJson(socket, formatSuccess(data));
            };
            subscriptions.set(message.jobId, send);
            options.eventBridge.addSubscription(new JobId(message.jobId), connection.userId, send);
          }

          sendJson(socket, formatSuccess({ type: "subscribed", jobId: message.jobId }));

          try {
            const snapshot = await options.getJobSnapshot(new JobId(message.jobId));
            if (snapshot) {
              const payload: Record<string, unknown> = {
                type: "job.snapshot",
                jobId: snapshot.id,
                status: snapshot.status,
              };
              if (snapshot.progress) {
                payload.progress = snapshot.progress;
              }
              if (snapshot.failedReason) {
                payload.failedReason = snapshot.failedReason;
              }
              sendJson(socket, formatSuccess(payload));
            }
          } catch {
            // Best effort snapshot.
          }
          return;
        }

        if (message.type === "unsubscribe") {
          const send = subscriptions.get(message.jobId);
          subscriptions.delete(message.jobId);
          if (send) {
            options.eventBridge.removeSubscription(new JobId(message.jobId), connection.userId, send);
          }
          sendJson(socket, formatSuccess({ type: "unsubscribed", jobId: message.jobId }));
          return;
        }

        if (message.type === "ping") {
          sendJson(socket, formatSuccess({ type: "pong" }));
        }
      } catch {
        sendJson(socket, formatError(ERROR_CODES.INVALID_MESSAGE, { details: "Invalid message format" }));
      }
    });

    socket.on("close", cleanupConnection);
    socket.on("error", cleanupConnection);
  });
};
