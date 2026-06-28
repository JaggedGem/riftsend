import { RoomId, SessionToken } from "@riftsend/shared";
import type { PeerId, RoomCredentials } from "@riftsend/shared";
import { WebSocket } from "ws";

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
