import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { AuthedWebSocket, SignalingMessage } from "./types.js";
import { SignalingMessageSchema } from "./types.js";
import { WebSocketServer } from "ws";
import { findClientByPeerId, peerMap, sessionMap } from "./peer.js";
import { checkRateLimit, safeSend } from "./utils.js";
import { handleHelloMessage } from "./handlers/hello.js";
import { handleRelayMessage } from "./handlers/relay.js";
import { logger, loggerOptions } from "./logger.js";
import {
  WS_PORT,
  HTTP_PORT,
  BIND_HOST,
  MAX_PAYLOAD,
  MAX_CONNECTIONS,
} from "./config.js";

export const app = Fastify({ logger: loggerOptions });

await app.register(cors, { origin: true });

const wss = new WebSocketServer({
  port: WS_PORT,
  maxPayload: MAX_PAYLOAD,
});

wss.on("connection", (ws: AuthedWebSocket) => {
  if (wss.clients.size > MAX_CONNECTIONS) {
    logger.warn("Connection limit reached, rejecting");
    ws.close(1013, "Too many connections");
    return;
  }

  logger.info({ remoteAddress: ws.url }, "New WebSocket connection");

  ws.on("message", (raw) => {
    try {
      if (!checkRateLimit(ws)) {
        logger.warn({ peerId: ws.peerId }, "Rate limit exceeded");
        ws.close(1008, "Rate limit exceeded");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        logger.warn({ peerId: ws.peerId }, "Invalid JSON received");
        ws.close(1008, "Invalid JSON");
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
          handleHelloMessage(ws, msg, wss);
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
      ws.close(1011, "Internal server error");
    }
  });

  ws.on("close", (code, reason) => {
    logger.info(
      { peerId: ws.peerId, code, reason: reason.toString() },
      "Client disconnected",
    );
    peerMap.delete(ws.peerId);

    if (ws.sessionToken) {
      sessionMap.delete(ws.sessionToken);
    }
  });

  ws.on("error", (err) => {
    logger.error({ err, peerId: ws.peerId }, "WebSocket error");
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
  app.log.info(`HTTP server listening at http://${BIND_HOST}:${HTTP_PORT}`);
  app.log.info(`WebSocket server listening on ws://${BIND_HOST}:${WS_PORT}`);
} catch (err) {
  app.log.fatal(err, "Failed to start server");
  process.exit(1);
}

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully");
  wss.close(() => {
    logger.info("WebSocket server closed");
  });
  app.close().then(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
