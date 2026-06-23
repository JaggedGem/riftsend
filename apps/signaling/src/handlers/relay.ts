import type {
  AuthedWebSocket,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
} from "../types.js";
import { findClientByPeerId } from "../peer.js";
import { safeSend } from "../utils.js";
import { logger } from "../logger.js";

type RelayMessage = OfferMessage | AnswerMessage | IceCandidateMessage;

export const handleRelayMessage = (
  ws: AuthedWebSocket,
  message: RelayMessage,
): void => {
  if (!ws.peerId) {
    logger.warn("Unauthenticated client sent relay message");
    ws.close(1008, "Not authenticated");
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
