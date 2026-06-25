import {
  generatePeerId,
  generateSessionToken,
  SignalingErrorCode,
  SignalingCloseCodes,
} from "@riftsend/shared";
import type { AuthedWebSocket } from "../types.js";
import type { HelloMessage, PeerIdMessage } from "@riftsend/protocol";
import { PeerIdZod, SessionTokenZod } from "@riftsend/protocol";
import { safeSend } from "../utils.js";
import { peerMap, sessionMap } from "../peer.js";
import type { WebSocketServer } from "ws";
import { logger } from "../logger.js";

const isAuthedWebSocket = (
  ws: WebSocketServer["clients"] extends Set<infer T> ? T : never,
): ws is AuthedWebSocket => {
  return "peerId" in ws;
};

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
    let existingClient: AuthedWebSocket | undefined;
    for (const client of wss.clients) {
      if (
        client !== ws &&
        isAuthedWebSocket(client) &&
        client.peerId === fromValid.data &&
        client.sessionToken === tokenValid.data
      ) {
        existingClient = client;
        break;
      }
    }

    if (existingClient) {
      logger.info({ peerId: fromValid.data }, "Client reconnected with valid session token");

      try {
        existingClient.close(
          SignalingCloseCodes[SignalingErrorCode.RECONNECTED_ELSEWHERE]!,
          SignalingErrorCode.RECONNECTED_ELSEWHERE,
        );
      } catch (err) {
        logger.error(
          { err, peerId: fromValid.data },
          "Failed to close existing connection during reconnect",
        );
      }

      peerMap.delete(existingClient.peerId);
      if (existingClient.sessionToken) {
        sessionMap.delete(existingClient.sessionToken);
      }

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
  logger.info({ peerId, name: ws.name, platform: ws.platform }, "Client assigned peerId");
};
