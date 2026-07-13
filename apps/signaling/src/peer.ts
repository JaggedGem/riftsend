import type { PeerId, SessionToken } from "@riftsend/shared";
import type { AuthedWebSocket } from "./types.js";

/**
 * A map of connected peers, keyed by their peer ID.
 * Each entry contains the corresponding {@link AuthedWebSocket} instance.
 */
export const peerMap = new Map<PeerId, AuthedWebSocket>();

/**
 * A map of active sessions, keyed by their session token.
 * Each entry contains the corresponding {@link AuthedWebSocket} instance.
 */
export const sessionMap = new Map<SessionToken, AuthedWebSocket>();

/**
 * Finds a connected client by its peer ID.
 * @param peerId The peer ID to search for.
 * @returns The corresponding {@link AuthedWebSocket} if found, otherwise undefined.
 */
export const findClientByPeerId = (peerId: PeerId): AuthedWebSocket | undefined => {
  return peerMap.get(peerId);
};

/**
 * Resets the peer and session state by clearing the `peerMap` and `sessionMap`.
 * This is useful for testing or when you need to clear all connected clients and sessions.
 */
export const resetPeerState = (): void => {
  peerMap.clear();
  sessionMap.clear();
};
