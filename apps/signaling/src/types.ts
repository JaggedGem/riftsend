import { RoomId, SessionToken } from "@riftsend/shared";
import type { PeerId, RoomCredentials } from "@riftsend/shared";
import { WebSocket } from "ws";
import { RoomMember } from "@riftsend/protocol";

export interface PeerInfo {
  id: PeerId;
  name: string;
}

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

export interface Room {
  roomCredentials: RoomCredentials;
  hostPeerId: PeerId;
  members: Map<PeerId, RoomMember>;
  createdAt: number;
  expiresAt: number;
  metadata: {
    name?: string;
    maxPeers: number;
  };
}
