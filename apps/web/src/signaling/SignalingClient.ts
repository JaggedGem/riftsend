import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import { getConfig } from "../config/config";
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

type SignalingClientEvents = {
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

/**
 * Client for the Riftsend signaling WebSocket protocol.
 *
 * Manages the WebSocket connection lifecycle, room join/leave, and relays
 * WebRTC signaling messages (offer, answer, ICE candidates) between peers.
 *
 * ## Lifecycle
 *
 * 1. Call {@link connect} to open the WebSocket and send a `hello` handshake.
 * 2. Wait for the `connected` event (server responds with `peer-id`).
 * 3. Call {@link sendJoinRoom} to join or create a room.
 * 4. Use {@link on} to subscribe to forwarded signaling messages.
 * 5. Call {@link disconnect} to tear down the connection.
 *
 * ## Events
 *
 * See {@link EventMap} for the full list of typed events.
 */
export class SignalingClient extends TypedEventEmitter<SignalingClientEvents> {
  private ws: WebSocket | null = null;
  private peerId: PeerId | null = null;
  private room: Room | null = null;

  connect(resume: false): void;
  connect(resume: true, peerId: PeerId, sessionToken: SessionToken): void;
  /**
   * Opens a WebSocket connection to the signaling server.
   *
   * If the socket is already open, it is torn down first.
   *
   * @param resume - When `true`, attempts to resume a previous session using
   *   the provided peerId and sessionToken.
   */
  connect(resume: boolean = false, peerId?: PeerId, sessionToken?: SessionToken): void {
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
      this.clearAll();
      this.ws = null;
    };

    this.ws.onerror = () => {
      this.emit("error", { message: "WebSocket encountered an error" });
    };
  }

  /**
   * Routes an incoming JSON message to the correct event emission based on its type.
   * Messages are validated against {@link SignalingMessageSchema} before processing.
   */
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
        // this.sessionToken = msg.payload.sessionToken;

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
        console.error("Received error message from signaling server:", msg.payload.code);

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

  /**
   * Serializes and sends a JSON message over the WebSocket.
   * Silently drops the message if the socket is not open.
   */
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
   * Sends a `join-room` message to join or create a room.
   *
   * - No roomId or joinCode → creates a new room (sender becomes host).
   * - `roomId` provided → joins an existing room by ID.
   * - `joinCode` provided (no roomId) → joins by human-readable code.
   */
  sendJoinRoom(role: "sender" | "receiver", roomId?: string, joinCode?: string): void {
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

  /** Sends a `leave-room` message for the currently joined room. */
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

  /**
   * Closes the WebSocket connection.
   *
   * @param code - WebSocket close code (default: 1000).
   * @param reason - Human-readable reason (default: "Client disconnect").
   */
  disconnect(code: number = 1000, reason: string = "Client disconnect"): void {
    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
  }

  /**
   * Sends a WebRTC SDP offer to a remote peer via the signaling relay.
   *
   * @throws If the WebSocket is not open or the offer has no SDP.
   */
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

  /**
   * Sends a WebRTC SDP answer to a remote peer via the signaling relay.
   *
   * @throws If the WebSocket is not open or the answer has no SDP.
   */
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

  /**
   * Sends an ICE candidate to a remote peer via the signaling relay.
   *
   * Fills in defaults for optional fields that may be missing from
   * `RTCIceCandidateInit`.
   *
   * @throws If the WebSocket is not open or peerId is not set.
   */
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
          candidate: candidate.candidate ?? "",
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          usernameFragment: candidate.usernameFragment ?? undefined,
        },
      },
    };

    this.send(iceCandidateMessage);
  }

  /**
   * Sends a peer error to a remote peer via the signaling relay.
   *
   * @throws If the WebSocket is not open or peerId is not set.
   */
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
