import type { PeerId, SessionToken } from "@riftsend/shared";
import type { AuthedWebSocket } from "./types.js";

export const peerMap = new Map<PeerId, AuthedWebSocket>();
export const sessionMap = new Map<SessionToken, AuthedWebSocket>();

export const findClientByPeerId = (peerId: PeerId): AuthedWebSocket | undefined => {
  return peerMap.get(peerId);
};

export const resetPeerState = (): void => {
  peerMap.clear();
  sessionMap.clear();
};
