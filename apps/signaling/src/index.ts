/**
 * Riftsend Signaling Server
 *
 * Entry point for the signaling server. Handles WebSocket connections and
 * relays signaling messages (offer, answer, ICE candidates) between peers in
 * a room. Also provides an HTTP health-check endpoint.
 *
 * ## Message flow
 *
 * - `hello` — Initial handshake; server responds with `peer-id`.
 * - `join-room` — Request to join or create a room.
 * - `leave-room` — Request to leave the current room.
 * - `offer`, `answer`, `ice-candidate` — WebRTC signaling relayed between
 *   peers in the same room.
 * - `peer-error` — Error messages forwarded between peers.
 *
 * ## Guardrails
 *
 * Rate limiting, connection caps, authentication timeouts, and heartbeat
 * checks prevent common abuse and keep connections stable.
 */

import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { AuthedWebSocket } from "./types.js";
import { SignalingMessageSchema, SignalingMessage } from "@riftsend/protocol";
import { WebSocketServer } from "ws";
import { peerMap, sessionMap } from "./peer.js";
import { checkRateLimit } from "./utils.js";
import { handleHelloMessage } from "./handlers/hello.js";
import { handleRelayMessage } from "./handlers/relay.js";
import { logger } from "./logger.js";
import {
  BIND_HOST,
  MAX_PAYLOAD,
  MAX_CONNECTIONS,
  CONNECTION_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
} from "./config.js";
import {
  handleJoinRoomMessage,
  handleLeaveRoomMessage,
  removePeerFromRoom,
  stopCleanupTimers,
} from "./handlers/rooms.js";
import { SignalingErrorCode, SignalingCloseCodes } from "@riftsend/shared";
import type { FastifyInstance } from "fastify";

/**
 * Creates and starts the signaling server (HTTP + WebSocket).
 *
 * @param override - Ports and timing overrides (used for testing or custom deployment).
 *   - `httpPort`: port for the HTTP health endpoint (default: 3000).
 *   - `wsPort`: port for the WebSocket server (default: 8080).
 *   - `heartbeatMs`: ping interval for keep-alive (default: 30s).
 *   - `connectionTimeoutMs`: time before closing an unauthenticated socket (default: 10s).
 *   - `maxConnections`: maximum concurrent WebSocket connections (default: 1000).
 */
export async function createServer(override?: {
  httpPort?: number;
  wsPort?: number;
  heartbeatMs?: number;
  connectionTimeoutMs?: number;
  maxConnections?: number;
}): Promise<{
  app: FastifyInstance;
  wss: WebSocketServer;
  httpPort: number;
  wsPort: number;
  stop: () => Promise<void>;
}> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  const wss = new WebSocketServer({
    port: override?.wsPort ?? 0,
    maxPayload: MAX_PAYLOAD,
  });

  const heartbeatMs = override?.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;
  const connTimeoutMs = override?.connectionTimeoutMs ?? CONNECTION_TIMEOUT_MS;
  const maxConn = override?.maxConnections ?? MAX_CONNECTIONS;

  app.get("/health", async () => {
    return {
      status: "healthy",
      connections: wss.clients.size,
    };
  });

  await app.listen({ port: override?.httpPort ?? 0, host: BIND_HOST });

  const httpAddr = app.addresses()[0];
  const httpPort =
    httpAddr && typeof httpAddr === "object" ? (httpAddr as { port: number }).port : 0;
  const wsAddr = wss.address();
  const wsPort = wsAddr && typeof wsAddr === "object" ? wsAddr.port : 0;

  wss.on("connection", (ws: AuthedWebSocket) => {
    if (wss.clients.size > maxConn) {
      logger.warn("Connection limit reached, rejecting");
      ws.close(
        SignalingCloseCodes[SignalingErrorCode.TOO_MANY_CONNECTIONS]!,
        SignalingErrorCode.TOO_MANY_CONNECTIONS,
      );
      return;
    }

    const remoteAddress =
      (ws as { _socket?: { remoteAddress?: string } })._socket?.remoteAddress ?? "unknown";
    logger.info({ remoteAddress }, "New WebSocket connection");

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    let authenticated = false;

    const connectionTimeout = setTimeout(() => {
      if (!authenticated) {
        logger.warn({ remoteAddress }, "Connection timeout, closing unauthenticated socket");
        ws.close(
          SignalingCloseCodes[SignalingErrorCode.NOT_AUTHENTICATED]!,
          SignalingErrorCode.NOT_AUTHENTICATED,
        );
      }
    }, connTimeoutMs);
    connectionTimeout.unref();

    ws.on("message", (raw) => {
      try {
        if (!checkRateLimit(ws)) {
          logger.warn({ peerId: ws.peerId }, "Rate limit exceeded");
          ws.close(
            SignalingCloseCodes[SignalingErrorCode.RATE_LIMIT_EXCEEDED]!,
            SignalingErrorCode.RATE_LIMIT_EXCEEDED,
          );
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          logger.warn({ peerId: ws.peerId }, "Invalid JSON received");
          ws.close(
            SignalingCloseCodes[SignalingErrorCode.INVALID_JSON]!,
            SignalingErrorCode.INVALID_JSON,
          );
          return;
        }

        const result = SignalingMessageSchema.safeParse(parsed);
        if (!result.success) {
          logger.warn({ err: result.error, peerId: ws.peerId }, "Schema validation failed");
          return;
        }

        const msg: SignalingMessage = result.data;

        switch (msg.type) {
          case "hello": {
            clearTimeout(connectionTimeout);
            authenticated = true;
            handleHelloMessage(ws, msg, wss);
            break;
          }

          case "join-room": {
            if (!ws.peerId) {
              logger.warn("Unauthenticated client sent join-room message");
              ws.close(
                SignalingCloseCodes[SignalingErrorCode.NOT_AUTHENTICATED]!,
                SignalingErrorCode.NOT_AUTHENTICATED,
              );
              return;
            }

            handleJoinRoomMessage(ws, msg);
            break;
          }

          case "leave-room": {
            if (!ws.peerId) {
              logger.warn("Unauthenticated client sent leave-room message");
              ws.close(
                SignalingCloseCodes[SignalingErrorCode.NOT_AUTHENTICATED]!,
                SignalingErrorCode.NOT_AUTHENTICATED,
              );
              return;
            }

            handleLeaveRoomMessage(ws, msg);
            break;
          }

          case "offer":
          case "answer":
          case "ice-candidate":
          case "peer-error": {
            handleRelayMessage(ws, msg);
            break;
          }

          default:
            logger.warn({ type: msg.type, peerId: ws.peerId }, "Unknown message type");
        }
      } catch (err) {
        logger.error({ err, peerId: ws.peerId }, "Unhandled error in message handler");
        ws.close(
          SignalingCloseCodes[SignalingErrorCode.INTERNAL_SERVER_ERROR]!,
          SignalingErrorCode.INTERNAL_SERVER_ERROR,
        );
      }
    });

    ws.on("close", (code, reason) => {
      clearTimeout(connectionTimeout);
      logger.info({ peerId: ws.peerId, code, reason: reason.toString() }, "Client disconnected");
      if (ws.peerId && peerMap.get(ws.peerId) === ws) {
        peerMap.delete(ws.peerId);
      }

      if (ws.sessionToken && sessionMap.get(ws.sessionToken) === ws) {
        sessionMap.delete(ws.sessionToken);
      }

      if (ws.roomId) {
        removePeerFromRoom(ws.roomId, ws);
      }
    });

    ws.on("error", (err) => {
      logger.error({ err, peerId: ws.peerId }, "WebSocket error");
      ws.close(
        SignalingCloseCodes[SignalingErrorCode.INTERNAL_SERVER_ERROR]!,
        SignalingErrorCode.INTERNAL_SERVER_ERROR,
      );
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authed = ws as AuthedWebSocket;
      if (authed.isAlive === false) {
        logger.warn({ peerId: authed.peerId }, "Heartbeat timeout, terminating");
        ws.terminate();
        return;
      }
      authed.isAlive = false;
      ws.ping();
    });
  }, heartbeatMs);
  heartbeatInterval.unref();

  const stop = async () => {
    stopCleanupTimers();
    clearInterval(heartbeatInterval);

    for (const ws of wss.clients) {
      ws.close(1001, "Server shutting down");
    }

    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });

    await app.close();
  };

  return { app, wss, httpPort, wsPort, stop };
}

/**
 * Starts the server using config from environment variables and installs
 * graceful shutdown handlers for SIGTERM and SIGINT.
 */
async function main() {
  const { WS_PORT, HTTP_PORT } = await import("./config.js");
  const server = await createServer({ httpPort: HTTP_PORT, wsPort: WS_PORT });

  server.app.log.info(`HTTP server listening at http://${BIND_HOST}:${server.httpPort}`);
  server.app.log.info(`WebSocket server listening on ws://${BIND_HOST}:${server.wsPort}`);

  process.on("SIGTERM", () => {
    server.app.log.info("SIGTERM received, shutting down");
    server.stop().catch((err) => server.app.log.error(err, "Error during shutdown"));
  });
  process.on("SIGINT", () => {
    server.app.log.info("SIGINT received, shutting down");
    server.stop().catch((err) => server.app.log.error(err, "Error during shutdown"));
  });
}

import { fileURLToPath } from "url";
import { resolve } from "path";

const isMain =
  process.argv[1] != null && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    logger.fatal(err, "Failed to start server");
    process.exit(1);
  });
}