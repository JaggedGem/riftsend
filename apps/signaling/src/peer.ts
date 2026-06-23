import { PeerId, SessionToken } from "@riftsend/shared";
import { AuthedWebSocket } from "./types.js";

export const peerMap = new Map<PeerId, AuthedWebSocket>();
export const sessionMap = new Map<SessionToken, AuthedWebSocket>();

export const findClientByPeerId = (
  peerId: string,
): AuthedWebSocket | undefined => {
  return peerMap.get(peerId as PeerId);
};
