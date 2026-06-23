import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import type {
  AuthedWebSocket,
  PeerIdMessage,
  SignalingMessage,
} from "./types.js";
import { SignalingMessageSchema, PeerIdZod, SessionTokenZod } from "./types.js";
import { WebSocketServer } from "ws";
import {
  generatePeerId,
  generateSessionToken,
  PeerId,
  SessionToken,
  RoomId,
} from "@riftsend/shared";

const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000", 10);
const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
const MAX_PAYLOAD = 1024 * 128;
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || "1000", 10);
const MAX_MESSAGES_PER_SEC = parseInt(
  process.env.MAX_MESSAGES_PER_SEC || "60",
  10,
);

const app = Fastify({
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: false,
        minimumLevel: "trace",
      },
    },
  },
});

await app.register(cors, { origin: true });

function safeSend(ws: AuthedWebSocket, data: unknown): void {
  if (ws.readyState !== ws.OPEN) {
    app.log.warn({ peerId: ws.peerId }, "⚠ Attempted send on non-open socket");
    return;
  }
  try {
    ws.send(JSON.stringify(data));
  } catch (err) {
    app.log.error({ err, peerId: ws.peerId }, "✘ Send failed");
  }
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};
const rateLimitMap = new WeakMap<AuthedWebSocket, RateLimitEntry>();

function checkRateLimit(ws: AuthedWebSocket): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ws);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 1000 };
    rateLimitMap.set(ws, entry);
  }
  entry.count++;
  return entry.count <= MAX_MESSAGES_PER_SEC;
}

function findClientByPeerId(peerId: string): AuthedWebSocket | undefined {
  return peerMap.get(peerId as PeerId);
}

const wss = new WebSocketServer({
  port: WS_PORT,
  maxPayload: MAX_PAYLOAD,
});

const peerMap = new Map<PeerId, AuthedWebSocket>();
const sessionMap = new Map<SessionToken, AuthedWebSocket>();

wss.on("connection", (ws: AuthedWebSocket) => {
  if (wss.clients.size > MAX_CONNECTIONS) {
    app.log.warn("✘ Connection limit reached, rejecting");
    ws.close(1013, "Too many connections");
    return;
  }

  app.log.info({ remoteAddress: ws.url }, "⊕ New WebSocket connection");

  ws.on("message", (raw) => {
    try {
      if (!checkRateLimit(ws)) {
        app.log.warn({ peerId: ws.peerId }, "⊘ Rate limit exceeded");
        ws.close(1008, "Rate limit exceeded");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        app.log.warn({ peerId: ws.peerId }, "⚠ Invalid JSON received");
        ws.close(1008, "Invalid JSON");
        return;
      }

      const result = SignalingMessageSchema.safeParse(parsed);
      if (!result.success) {
        app.log.warn(
          { err: result.error, peerId: ws.peerId },
          "◎ Schema validation failed",
        );
        return;
      }

      const msg: SignalingMessage = result.data;

      switch (msg.type) {
        case "hello": {
          if (ws.peerId) {
            app.log.warn({ peerId: ws.peerId }, "⚠ Duplicate hello message");
            return;
          }

          const fromValid = PeerIdZod.safeParse(msg.from);
          const tokenValid = SessionTokenZod.safeParse(msg.sessionToken);

          if (fromValid.success && tokenValid.success) {
            const existingClient = [...wss.clients].find(
              (client) =>
                client !== ws &&
                (client as AuthedWebSocket).peerId === fromValid.data &&
                (client as AuthedWebSocket).sessionToken === tokenValid.data,
            ) as AuthedWebSocket | undefined;

            if (existingClient) {
              app.log.info(
                { peerId: fromValid.data },
                "↻ Client reconnected with valid session token",
              );

              existingClient.close(1000, "Reconnected elsewhere");

              const newSessionToken = generateSessionToken();
              const peerIdMsg: PeerIdMessage = {
                type: "peer-id",
                from: "server",
                payload: {
                  peerId: fromValid.data,
                  sessionToken: newSessionToken,
                },
              };

              safeSend(ws, peerIdMsg);

              ws.peerId = fromValid.data;
              ws.sessionToken = newSessionToken;
              ws.name = msg.payload.name;
              ws.protocolVersion = msg.protocolVersion;
              ws.clientVersion = msg.clientVersion;
              ws.role = msg.payload.role;
              ws.platform = msg.payload.platform;
              ws.supportResume = msg.payload.supportResume;
              ws.supportChunkAck = msg.payload.supportChunkAck;

              peerMap.set(ws.peerId, ws);
              sessionMap.set(ws.sessionToken, ws);

              return;
            }
          }

          const peerId = generatePeerId();
          const sessionToken = generateSessionToken();

          ws.peerId = peerId;
          ws.name = msg.payload.name;
          ws.protocolVersion = msg.protocolVersion;
          ws.clientVersion = msg.clientVersion;
          ws.sessionToken = sessionToken;
          ws.role = msg.payload.role;
          ws.platform = msg.payload.platform;
          ws.supportResume = msg.payload.supportResume;
          ws.supportChunkAck = msg.payload.supportChunkAck;

          peerMap.set(peerId, ws);
          sessionMap.set(sessionToken, ws);

          const peerIdMsg: PeerIdMessage = {
            type: "peer-id",
            from: "server",
            payload: { peerId, sessionToken },
          };

          safeSend(ws, peerIdMsg);
          app.log.info({ peerId, role: ws.role }, "✓ Client assigned peerId");
          break;
        }

        case "offer":
        case "answer":
        case "ice-candidate": {
          if (!ws.peerId) {
            app.log.warn("⚠ Unauthenticated client sent message");
            ws.close(1008, "Not authenticated");
            return;
          }

          const target = findClientByPeerId(msg.to);
          if (!target) {
            app.log.warn(
              { from: msg.from, to: msg.to, type: msg.type },
              "∅ Target peer not found",
            );
            return;
          }

          safeSend(target, msg);
          break;
        }

        default:
          app.log.warn(
            { type: (msg as { type: string }).type, peerId: ws.peerId },
            "¿ Unknown message type",
          );
      }
    } catch (err) {
      app.log.error(
        { err, peerId: ws.peerId },
        "✘ Unhandled error in message handler",
      );
      ws.close(1011, "Internal server error");
    }
  });

  ws.on("close", (code, reason) => {
    app.log.info(
      { peerId: ws.peerId, code, reason: reason.toString() },
      "⊣ Client disconnected",
    );
    peerMap.delete(ws.peerId);

    if (ws.sessionToken) {
      sessionMap.delete(ws.sessionToken);
    }
  });

  ws.on("error", (err) => {
    app.log.error({ err, peerId: ws.peerId }, "✘ WebSocket error");
  });
});

app.get("/health", async () => {
  return {
    status: "healthy",
    connections: wss.clients.size,
  };
});

try {
  await app.listen({ port: HTTP_PORT, host: BIND_HOST });
  app.log.info(`◇ HTTP server listening at http://${BIND_HOST}:${HTTP_PORT}`);
  app.log.info(`◇ WebSocket server listening on ws://${BIND_HOST}:${WS_PORT}`);
} catch (err) {
  app.log.fatal(err, "✘ Failed to start server");
  process.exit(1);
}

function shutdown(signal: string) {
  app.log.info({ signal }, "■ Shutting down gracefully");
  wss.close(() => {
    app.log.info("■ WebSocket server closed");
  });
  app.close().then(() => {
    app.log.info("■ HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
