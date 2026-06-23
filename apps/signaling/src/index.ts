import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { AuthedWebSocket, SignalingMessage } from "./types.js";
import { SignalingMessageSchema } from "./types.js";
import { WebSocketServer } from "ws";
import { peerMap, sessionMap } from "./peer.js";
import { checkRateLimit } from "./utils.js";
import { handleHelloMessage } from "./handlers/hello.js";
import { handleRelayMessage } from "./handlers/relay.js";
import { logger, loggerOptions } from "./logger.js";
import {
  WS_PORT,
  HTTP_PORT,
  BIND_HOST,
  MAX_PAYLOAD,
  MAX_CONNECTIONS,
  CONNECTION_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
} from "./config.js";
import {
  handleJoinRoomMessage,
  removePeerFromRoom,
  stopCleanupTimers,
} from "./handlers/rooms.js";
import { SignalingErrorCode, SignalingCloseCodes } from "@riftsend/shared";

export const app = Fastify({ logger: loggerOptions });

await app.register(cors, { origin: true });

const wss = new WebSocketServer({
  port: WS_PORT,
  maxPayload: MAX_PAYLOAD,
});

wss.on("connection", (ws: AuthedWebSocket) => {
  if (wss.clients.size > MAX_CONNECTIONS) {
    logger.warn("Connection limit reached, rejecting");
    ws.close(
      SignalingCloseCodes[SignalingErrorCode.TOO_MANY_CONNECTIONS]!,
      SignalingErrorCode.TOO_MANY_CONNECTIONS,
    );
    return;
  }

  const remoteAddress =
    (ws as { _socket?: { remoteAddress?: string } })._socket?.remoteAddress ??
    "unknown";
  logger.info({ remoteAddress }, "New WebSocket connection");

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  let authenticated = false;

  const connectionTimeout = setTimeout(() => {
    if (!authenticated) {
      logger.warn(
        { remoteAddress },
        "Connection timeout, closing unauthenticated socket",
      );
      ws.close(
        SignalingCloseCodes[SignalingErrorCode.NOT_AUTHENTICATED]!,
        SignalingErrorCode.NOT_AUTHENTICATED,
      );
    }
  }, CONNECTION_TIMEOUT_MS);
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
        logger.warn(
          { err: result.error, peerId: ws.peerId },
          "Schema validation failed",
        );
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

        case "offer":
        case "answer":
        case "ice-candidate": {
          handleRelayMessage(ws, msg);
          break;
        }

        default:
          logger.warn(
            { type: (msg as { type: string }).type, peerId: ws.peerId },
            "Unknown message type",
          );
      }
    } catch (err) {
      logger.error(
        { err, peerId: ws.peerId },
        "Unhandled error in message handler",
      );
      ws.close(
        SignalingCloseCodes[SignalingErrorCode.INTERNAL_SERVER_ERROR]!,
        SignalingErrorCode.INTERNAL_SERVER_ERROR,
      );
    }
  });

  ws.on("close", (code, reason) => {
    clearTimeout(connectionTimeout);
    logger.info(
      { peerId: ws.peerId, code, reason: reason.toString() },
      "Client disconnected",
    );
    if (ws.peerId) {
      peerMap.delete(ws.peerId);
    }

    if (ws.sessionToken) {
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
}, HEARTBEAT_INTERVAL_MS);
heartbeatInterval.unref();

app.get("/health", async () => {
  return {
    status: "healthy",
    connections: wss.clients.size,
  };
});

try {
  await app.listen({ port: HTTP_PORT, host: BIND_HOST });
  app.log.info(`HTTP server listening at http://${BIND_HOST}:${HTTP_PORT}`);
  app.log.info(`WebSocket server listening on ws://${BIND_HOST}:${WS_PORT}`);
} catch (err) {
  app.log.fatal(err, "Failed to start server");
  process.exit(1);
}

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  stopCleanupTimers();
  clearInterval(heartbeatInterval);

  for (const ws of wss.clients) {
    ws.close(1001, "Server shutting down");
  }

  wss.close(() => {
    logger.info("WebSocket server closed");
  });

  app.close().catch((err) => {
    logger.error({ err }, "Error closing HTTP server");
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
