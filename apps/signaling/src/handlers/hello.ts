import { generatePeerId, generateSessionToken } from "@riftsend/shared";
import type { AuthedWebSocket, HelloMessage, PeerIdMessage } from "../types.js";
import { PeerIdZod, SessionTokenZod } from "../types.js";
import { safeSend } from "../utils.js";
import { peerMap, sessionMap } from "../peer.js";
import type { WebSocketServer } from "ws";
import { logger } from "../logger.js";

export const handleHelloMessage = (
  ws: AuthedWebSocket,
  message: HelloMessage,
  wss: WebSocketServer,
): void => {
  if (ws.peerId) {
    logger.warn({ peerId: ws.peerId }, "Duplicate hello message");
    return;
  }

  const fromValid = PeerIdZod.safeParse(message.from);
  const tokenValid = SessionTokenZod.safeParse(message.sessionToken);

  if (fromValid.success && tokenValid.success) {
    const existingClient = [...wss.clients].find(
      (client) =>
        client !== ws &&
        (client as AuthedWebSocket).peerId === fromValid.data &&
        (client as AuthedWebSocket).sessionToken === tokenValid.data,
    ) as AuthedWebSocket | undefined;

    if (existingClient) {
      logger.info(
        { peerId: fromValid.data },
        "Client reconnected with valid session token",
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
      ws.name = message.payload.name;
      ws.protocolVersion = message.protocolVersion;
      ws.clientVersion = message.clientVersion;
      ws.role = message.payload.role;
      ws.platform = message.payload.platform;
      ws.supportResume = message.payload.supportResume;
      ws.supportChunkAck = message.payload.supportChunkAck;

      peerMap.set(ws.peerId, ws);
      sessionMap.set(ws.sessionToken, ws);

      return;
    }
  }

  const peerId = generatePeerId();
  const sessionToken = generateSessionToken();

  ws.peerId = peerId;
  ws.name = message.payload.name;
  ws.protocolVersion = message.protocolVersion;
  ws.clientVersion = message.clientVersion;
  ws.sessionToken = sessionToken;
  ws.role = message.payload.role;
  ws.platform = message.payload.platform;
  ws.supportResume = message.payload.supportResume;
  ws.supportChunkAck = message.payload.supportChunkAck;

  peerMap.set(peerId, ws);
  sessionMap.set(sessionToken, ws);

  const peerIdMsg: PeerIdMessage = {
    type: "peer-id",
    from: "server",
    payload: { peerId, sessionToken },
  };

  safeSend(ws, peerIdMsg);
  logger.info({ peerId, role: ws.role }, "Client assigned peerId");
};
