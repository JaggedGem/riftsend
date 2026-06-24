import type {
  AuthedWebSocket,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
} from "../types.js";
import { findClientByPeerId } from "../peer.js";
import { safeSend } from "../utils.js";
import { logger } from "../logger.js";
import { SignalingErrorCode, SignalingCloseCodes } from "@riftsend/shared";

type RelayMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

export const handleRelayMessage = (ws: AuthedWebSocket, message: RelayMessage): void => {
  if (!ws.peerId) {
    logger.warn("Unauthenticated client sent relay message");
    ws.close(
      SignalingCloseCodes[SignalingErrorCode.NOT_AUTHENTICATED]!,
      SignalingErrorCode.NOT_AUTHENTICATED,
    );
    return;
  }

  if (message.from !== ws.peerId) {
    logger.warn(
      { from: message.from, peerId: ws.peerId, type: message.type },
      "Peer attempted to spoof message.from",
    );
    ws.close(
      SignalingCloseCodes[SignalingErrorCode.NOT_AUTHENTICATED]!,
      SignalingErrorCode.NOT_AUTHENTICATED,
    );
    return;
  }

  const target = findClientByPeerId(message.to);
  if (!target) {
    logger.warn(
      { from: message.from, to: message.to, type: message.type },
      "Target peer not found",
    );
    return;
  }

  safeSend(target, message);
};
