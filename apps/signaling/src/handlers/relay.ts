import type { AuthedWebSocket } from "../types.js";
import type {
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  PeerErrorMessage,
} from "@riftsend/protocol";
import { findClientByPeerId } from "../peer.js";
import { safeSend } from "../utils.js";
import { logger } from "../logger.js";
import { SignalingErrorCode, SignalingCloseCodes } from "@riftsend/shared";

/**
 * Type representing a relay message, which can be an offer, answer, ICE candidate, or peer error message.
 */
type RelayMessage = OfferMessage | AnswerMessage | IceCandidateMessage | PeerErrorMessage;

/**
 * Handles a relay message from a client WebSocket connection.
 * Validates the message, checks for authentication, and forwards it to the target peer if found.
 * @param ws - The authenticated WebSocket connection.
 * @param message - The relay message received from the client.
 */
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
