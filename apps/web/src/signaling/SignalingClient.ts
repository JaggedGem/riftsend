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
  type LeaveRoomMessage,
  type RoomLeftMessage,
  type RoomExpiredMessage,
  type RoomPeerLeftMessage,
  type RoomPeerJoinedMessage,
  type PeerIdMessage,
  type OfferMessage,
  type AnswerMessage,
  type IceCandidateMessage,
  type PeerErrorMessage,
} from "@riftsend/protocol";
import { type Room } from "@riftsend/shared";

type EventMap = {
  connected: PeerIdMessage["payload"];
  "room-joined": Room;
  "room-peer-joined": RoomPeerJoinedMessage["payload"];
  "room-peer-left": RoomPeerLeftMessage["payload"];
  "room-expired": RoomExpiredMessage["payload"];
  "room-left": RoomLeftMessage["payload"];
  disconnected: { code: number; reason: string };
  error: { message: string };
  offer: OfferMessage["payload"];
  answer: AnswerMessage["payload"];
  iceCandidate: IceCandidateMessage["payload"];
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
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }

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
      this.ws = null;
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
        const roomJoined: Room = {
          roomCredentials: {
            roomId: msg.payload.roomId,
            joinCode: msg.payload.joinCode,
          },
          hostPeerId: msg.payload.hostPeerId,
          metadata: {
            name: msg.payload.roomName,
            maxPeers: msg.payload.maxPeers,
          },
          createdAt: msg.payload.createdAt,
          expiresAt: msg.payload.expiresAt,
          members: msg.payload.members,
        };

        this.room = roomJoined;

        this.emit("room-joined", roomJoined);
        break;
      }

      case "room-peer-joined": {
        if (!this.room) {
          console.warn("Received room-peer-joined but not in a room");
          break;
        }

        this.room.members[msg.payload.peerId] = {
          peerId: msg.payload.peerId,
          joinedAt: msg.payload.joinedAt,
        };

        this.emit("room-peer-joined", {
          peerId: msg.payload.peerId,
          roomId: msg.payload.roomId,
          joinedAt: msg.payload.joinedAt,
        });
        break;
      }

      case "room-peer-left": {
        if (!this.room) {
          console.warn("Received room-peer-left but not in a room");
          break;
        }

        delete this.room.members[msg.payload.peerId];

        this.emit("room-peer-left", {
          peerId: msg.payload.peerId,
          roomId: msg.payload.roomId,
          leftAt: msg.payload.leftAt,
        });
        break;
      }

      case "room-expired": {
        this.room = null;

        this.emit("room-expired", { roomId: msg.payload.roomId });
        break;
      }

      case "room-left": {
        this.room = null;

        this.emit("room-left", {
          roomId: msg.payload.roomId,
          peerId: msg.payload.peerId,
        });
        break;
      }

      case "error": {
        console.error(
          "Received error message from signaling server:",
          msg.payload.code,
        );

        this.emit("error", { message: `Signaling error: ${msg.payload.code}` });
        break;
      }

      case "offer": {
        this.emit("offer", msg.payload);
        break;
      }

      case "answer": {
        this.emit("answer", msg.payload);
        break;
      }

      case "ice-candidate": {
        this.emit("iceCandidate", msg.payload);
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

  sendLeaveRoom(): void {
    if (!this.peerId) {
      throw new Error("Cannot leave room: peerId is not set");
    }

    if (!this.room) {
      console.warn("Cannot leave room: not currently in a room");
      return;
    }

    const leaveRoomMessage: LeaveRoomMessage = {
      type: "leave-room",
      from: this.peerId,
      payload: null,
    };
    this.send(leaveRoomMessage);
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

  disconnect(code: number = 1000, reason: string = "Client disconnect"): void {
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
  }

  sendOffer(to: PeerId, description: RTCSessionDescriptionInit): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send offer: WebSocket is not open");
    }

    if (!this.peerId) {
      throw new Error("Cannot send offer: peerId is not set");
    }

    if (!description.sdp) {
      throw new Error("Cannot send offer: description.sdp is not set");
    }

    const offerMessage: OfferMessage = {
      type: "offer",
      from: this.peerId,
      to,
      payload: {
        description: {
          type: "offer",
          sdp: description.sdp,
        },
      },
    };

    this.send(offerMessage);
  }

  sendAnswer(to: PeerId, description: RTCSessionDescriptionInit): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send answer: WebSocket is not open");
    }

    if (!this.peerId) {
      throw new Error("Cannot send answer: peerId is not set");
    }

    if (!description.sdp) {
      throw new Error("Cannot send answer: description.sdp is not set");
    }

    const answerMessage: AnswerMessage = {
      type: "answer",
      from: this.peerId,
      to,
      payload: {
        description: {
          type: "answer",
          sdp: description.sdp,
        },
      },
    };

    this.send(answerMessage);
  }

  sendIceCandidate(to: PeerId, candidate: RTCIceCandidateInit): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send ICE candidate: WebSocket is not open");
    }

    if (!this.peerId) {
      throw new Error("Cannot send ICE candidate: peerId is not set");
    }

    const iceCandidateMessage: IceCandidateMessage = {
      type: "ice-candidate",
      from: this.peerId,
      to,
      payload: {
        candidate: {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          usernameFragment: candidate.usernameFragment,
        },
      },
    };

    this.send(iceCandidateMessage);
  }

  sendError(to: PeerId, error: PeerErrorMessage["payload"]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send error: WebSocket is not open");
    }

    if (!this.peerId) {
      throw new Error("Cannot send error: peerId is not set");
    }

    const errorMessage: PeerErrorMessage = {
      type: "peer-error",
      from: this.peerId,
      to,
      payload: error,
    };

    this.send(errorMessage);
  }
}
