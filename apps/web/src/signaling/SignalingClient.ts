import { getConfig } from "./config";
import {
  SignalingMessageSchema,
  type HelloMessage,
  type PeerId,
  type SessionToken,
  type JoinRoomMessage,
  type JoinRoomPayload,
  RoomIdZod,
  JoinCodeZod,
  type RoomMember,
} from "@riftsend/protocol";

interface Room {
  roomId: string;
  joinCode: string;
  members: RoomMember[];
}

type EventMap = {
  connected: { peerId: PeerId; sessionToken: SessionToken };
  "room-joined": Room;
  "room-peer-joined": { peerId: string; roomId: string };
  "room-peer-left": { peerId: string; roomId: string };
  "room-expired": { roomId: string };
  disconnected: { code: number; reason: string };
  error: { message: string };
};

type EventHandler<T> = (payload: T) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private peerId: PeerId | null = null;
  private sessionToken: SessionToken | null = null;
  private room: Room | null = null;
  private listeners = new Map<string, Set<(payload: unknown) => void>>();

  connect(resume: false): void;
  connect(resume: true, peerId: PeerId, sessionToken: SessionToken): void;
  connect(
    resume: boolean = false,
    peerId?: PeerId,
    sessionToken?: SessionToken,
  ): void {
    this.ws = new WebSocket(getConfig().signalingUrl);

    this.ws.onopen = () => {
      const cfg = getConfig();
      const helloMessage: HelloMessage = {
        type: "hello",
        from: resume ? peerId! : null,
        sessionToken: resume ? sessionToken! : null,
        protocolVersion: cfg.protocolVersion,
        clientVersion: cfg.clientVersion,
        payload: {
          name: cfg.clientName,
          platform: cfg.clientPlatform,
          supportResume: cfg.supportResume,
          supportChunkAck: cfg.supportChunkAck,
        },
      };

      this.send(helloMessage);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Failed to parse signaling message:", error);
      }
    };

    this.ws.onclose = (event) => {
      const sanitizedReason = event.reason.slice(0, 256);
      this.emit("disconnected", {
        code: event.code,
        reason: sanitizedReason,
      });
      this.listeners.clear();
    };

    this.ws.onerror = () => {
      this.emit("error", { message: "WebSocket encountered an error" });
    };
  }

  private handleMessage(message: unknown): void {
    const result = SignalingMessageSchema.safeParse(message);
    if (!result.success) {
      console.error("Invalid signaling message:", result.error);
      return;
    }

    const msg = result.data;

    switch (msg.type) {
      case "peer-id": {
        this.peerId = msg.payload.peerId;
        this.sessionToken = msg.payload.sessionToken;

        this.emit("connected", {
          peerId: msg.payload.peerId,
          sessionToken: msg.payload.sessionToken,
        });
        break;
      }

      case "room-joined": {
        this.room = {
          roomId: msg.payload.roomId,
          joinCode: msg.payload.joinCode,
          members: msg.payload.members,
        };

        this.emit("room-joined", this.room);
        break;
      }

      case "room-peer-joined": {
        this.emit("room-peer-joined", {
          peerId: msg.payload.peerId,
          roomId: msg.payload.roomId,
        });
        break;
      }

      case "room-peer-left": {
        this.emit("room-peer-left", {
          peerId: msg.payload.peerId,
          roomId: msg.payload.roomId,
        });
        break;
      }

      case "room-expired": {
        this.emit("room-expired", { roomId: msg.payload.roomId });
        break;
      }

      default:
        console.warn("Unhandled signaling message type:", msg.type);
    }
  }

  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("Attempted send on non-open socket");
      return;
    }
    try {
      this.ws.send(JSON.stringify(data));
    } catch (err) {
      console.error("Send failed:", err);
    }
  }

  /**
   * Join or create a room.
   *
   * - If neither `roomId` nor `joinCode` is provided, a new room is created.
   * - If `roomId` is provided, joins an existing room by its ID.
   * - If `joinCode` is provided (and `roomId` is not), joins by join code.
   */
  sendJoinRoom(
    role: "sender" | "receiver",
    roomId?: string,
    joinCode?: string,
  ): void {
    if (!this.peerId) {
      throw new Error("Cannot join room: peerId is not set");
    }

    let payload: JoinRoomPayload;
    if (roomId) {
      const parsed = RoomIdZod.safeParse(roomId);
      if (!parsed.success) throw new Error("Invalid room ID");

      payload = { method: "id", roomId: parsed.data, role };
    } else if (joinCode) {
      const parsed = JoinCodeZod.safeParse(joinCode);
      if (!parsed.success) throw new Error("Invalid join code");

      payload = { method: "code", joinCode: parsed.data, role };
    } else {
      payload = { method: "create", role };
    }

    const joinRoomMessage: JoinRoomMessage = {
      type: "join-room",
      from: this.peerId,
      payload,
    };

    this.send(joinRoomMessage);
  }

  on<K extends keyof EventMap>(
    type: K,
    handler: EventHandler<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as (payload: unknown) => void);
    return () => this.off(type, handler);
  }

  off<K extends keyof EventMap>(
    type: K,
    handler: EventHandler<EventMap[K]>,
  ): void {
    this.listeners.get(type)?.delete(handler as (payload: unknown) => void);
  }

  private emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    this.listeners.get(type)?.forEach((handler) => {
      (handler as EventHandler<EventMap[K]>)(payload);
    });
  }
}
