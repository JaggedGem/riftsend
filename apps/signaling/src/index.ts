import Fastify from "fastify";
import {
  AuthedWebSocket,
  PeerIdMessage,
  SignalingMessageSchema,
  SignalingMessage,
  PeerIdZod,
  SessionTokenZod,
} from "./types";
import { WebSocketServer } from "ws";
import { generatePeerId } from "@riftsend/shared";
import { generateSessionToken } from "@riftsend/shared";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000", 10);
const BIND_HOST = process.env.BIND_HOST || "0.0.0.0";
const MAX_PAYLOAD = 1024 * 128; // 128KB

const app = Fastify();

const wss = new WebSocketServer({
  port: WS_PORT,
  maxPayload: MAX_PAYLOAD,
});

wss.on("connection", (ws: AuthedWebSocket) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    let parsedMessage: unknown;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch {
      console.error("Invalid JSON received");
      ws.close(1008, "Invalid JSON");
      return;
    }

    const result = SignalingMessageSchema.safeParse(parsedMessage);

    if (!result.success) {
      console.error("Invalid message received:", result.error);
      return;
    }

    const signalingMessage: SignalingMessage = result.data;

    switch (signalingMessage.type) {
      case "hello": {
        if (ws.peerId) {
          console.warn(
            `Client ${ws.peerId} sent hello message after already being assigned a peerId`,
          );
          return;
        }

        const fromValid = PeerIdZod.safeParse(signalingMessage.from);
        const tokenValid = SessionTokenZod.safeParse(
          signalingMessage.sessionToken,
        );

        if (fromValid.success && tokenValid.success) {
          const existingClient = [...wss.clients].find(
            (client) =>
              client !== ws &&
              (client as AuthedWebSocket).peerId === fromValid.data &&
              (client as AuthedWebSocket).sessionToken === tokenValid.data,
          ) as AuthedWebSocket | undefined;

          if (existingClient) {
            console.log(
              `Client ${fromValid.data} reconnected with valid session token`,
            );

            existingClient.close(1000, "Reconnected with valid session token");

            const newSessionToken = generateSessionToken();

            const peerIdMessage: PeerIdMessage = {
              type: "peer-id",
              from: "server",
              payload: {
                peerId: fromValid.data,
                sessionToken: newSessionToken,
              },
            };

            ws.send(JSON.stringify(peerIdMessage));

            ws.peerId = fromValid.data;
            ws.sessionToken = newSessionToken;
            ws.name = signalingMessage.payload.name;
            ws.protocolVersion = signalingMessage.protocolVersion;
            ws.clientVersion = signalingMessage.clientVersion;
            ws.role = signalingMessage.payload.role;
            ws.platform = signalingMessage.payload.platform;
            ws.supportResume = signalingMessage.payload.supportResume;
            ws.supportChunkAck = signalingMessage.payload.supportChunkAck;

            return;
          }
        }

        const peerIdMessage: PeerIdMessage = {
          type: "peer-id",
          from: "server",
          payload: {
            peerId: generatePeerId(),
            sessionToken: generateSessionToken(),
          },
        };

        ws.peerId = peerIdMessage.payload.peerId;
        ws.name = signalingMessage.payload.name;
        ws.protocolVersion = signalingMessage.protocolVersion;
        ws.clientVersion = signalingMessage.clientVersion;
        ws.sessionToken = peerIdMessage.payload.sessionToken;
        ws.role = signalingMessage.payload.role;
        ws.platform = signalingMessage.payload.platform;
        ws.supportResume = signalingMessage.payload.supportResume;
        ws.supportChunkAck = signalingMessage.payload.supportChunkAck;

        ws.send(JSON.stringify(peerIdMessage));
        break;
      }

      default:
        console.warn(
          `Received unknown message type: ${signalingMessage.type} from ${signalingMessage.from}`,
        );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
});

app.get("/health", async (_request, reply) => {
  return { status: "healthy" };
});

app.listen({ port: HTTP_PORT, host: BIND_HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`HTTP health server listening at ${address}`);
  console.log(`WebSocket server listening on port ${WS_PORT}`);
});
