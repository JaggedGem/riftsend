import Fastify from "fastify";
import {
  AuthedWebSocket,
  PeerIdMessage,
  SignalingMessageSchema,
  SignalingMessage,
} from "./types";
import { WebSocketServer } from "ws";
import { generatePeerId } from "../../../packages/shared/src/peerId";

const app = Fastify();

const wss = new WebSocketServer({
  port: 8080,
});

wss.on("connection", (ws: AuthedWebSocket) => {
  console.log("New client connected");

  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message.toString());

    const result = SignalingMessageSchema.safeParse(parsedMessage);

    if (!result.success) {
      console.error("Invalid message received:", result.error);
      return;
    }

    const signalingMessage: SignalingMessage = result.data;

    switch (signalingMessage.type) {
      case "hello": {
        const peerIdMessage: PeerIdMessage = {
          type: "peer-id",
          from: "server",
          payload: generatePeerId(),
        };

        ws.peerId = peerIdMessage.payload;
        ws.name = signalingMessage.payload.name;
        ws.protocolVersion = signalingMessage.protocolVersion;
        ws.clientVersion = signalingMessage.clientVersion;
        ws.sessionToken = signalingMessage.sessionToken;
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
});

app.get("/health", async (request, reply) => {
  return { status: "healthy" };
});

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
