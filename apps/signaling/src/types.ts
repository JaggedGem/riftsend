import { RoomId, SessionToken } from "@riftsend/shared";
import type { PeerId } from "@riftsend/shared";
import { WebSocket } from "ws";

/**
 * Public info about a peer, safe to share with other room members.
 */
export interface PeerInfo {
  id: PeerId;
  name: string;
}

/**
 * WebSocket connection that has completed the `hello` handshake.
 *
 * Properties are populated by {@link handleHelloMessage} after a successful
 * handshake and used throughout the rest of the connection lifecycle.
 */
export interface AuthedWebSocket extends WebSocket {
  peerId: PeerId;
  name: string;
  protocolVersion: number;
  clientVersion: string;
  sessionToken: SessionToken | null;
  role?: "sender" | "receiver";
  platform: string;
  supportResume: boolean;
  supportChunkAck: boolean;
  roomId: RoomId | null;
  isAlive: boolean;
}
