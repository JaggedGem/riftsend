import { WebSocket } from "ws";
import type { ErrorMessage, PeerIdMessage } from "@riftsend/protocol";
import type { PeerId, SessionToken, SignalingErrorCode } from "@riftsend/shared";

export type MessageType =
  | "peer-id"
  | "hello"
  | "room-joined"
  | "room-left"
  | "room-peer-joined"
  | "room-peer-left"
  | "room-expired"
  | "error"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "join-room"
  | "leave-room";

export interface ServerMessage {
  type: MessageType;
  from: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TestClientOptions {
  name?: string;
  role?: "sender" | "receiver";
  platform?: string;
  protocolVersion?: number;
  clientVersion?: string;
  supportResume?: boolean;
  supportChunkAck?: boolean;
}

/**
 * A test client for interacting with the signaling server.
 * This class provides methods to connect, authenticate, send messages, and receive messages from the server.
 */
export class TestClient {
  public peerId!: PeerId;
  public sessionToken!: SessionToken;
  private received: ServerMessage[] = [];
  private listeners = new Map<string, Array<(msg: ServerMessage) => void>>();
  private closed = false;
  private closePromise: Promise<{ code: number; reason: string }>;
  private resolveClose!: (value: { code: number; reason: string }) => void;

  /**
   * Constructs a new TestClient instance with the provided WebSocket connection.
   * @param ws The WebSocket connection to the signaling server.
   */
  private constructor(public readonly ws: WebSocket) {
    this.closePromise = new Promise((resolve) => {
      this.resolveClose = resolve;
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        this.received.push(msg);

        const typeListeners = this.listeners.get(msg.type);
        if (typeListeners) {
          for (const listener of typeListeners) {
            listener(msg);
          }
        }

        const wildcard = this.listeners.get("*");
        if (wildcard) {
          for (const listener of wildcard) {
            listener(msg);
          }
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", (code, reason) => {
      this.closed = true;
      this.resolveClose({ code, reason: reason.toString() });
    });
  }

  /**
   * Connects to the signaling server at the specified URL and returns a new TestClient instance.
   * @param url The WebSocket URL of the signaling server.
   * @returns A promise that resolves to the connected TestClient instance.
   */
  static async connect(url: string): Promise<TestClient> {
    const ws = new WebSocket(url);
    const client = new TestClient(ws);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
      ws.on("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return client;
  }

  /**
   * Authenticates the test client with the signaling server by sending a "hello" message.
   * This method retrieves and sets the peer ID and session token for the client.
   * @param opts Optional configuration for the test client.
   * @returns A promise that resolves when authentication is complete.
   */
  async authenticate(opts: TestClientOptions = {}): Promise<void> {
    const helloMsg = {
      type: "hello",
      from: null,
      protocolVersion: opts.protocolVersion ?? 1,
      clientVersion: opts.clientVersion ?? "1.0.0",
      sessionToken: null,
      payload: {
        name: opts.name ?? "test-client",
        platform: opts.platform ?? "test",
        supportResume: opts.supportResume ?? false,
        supportChunkAck: opts.supportChunkAck ?? false,
      },
    };

    this.sendRaw(helloMsg);

    const peerIdMsg = await this.receive<PeerIdMessage>("peer-id");
    this.peerId = peerIdMsg.payload.peerId as PeerId;
    this.sessionToken = peerIdMsg.payload.sessionToken as SessionToken;
  }

  /**
   * Creates and connects a new test client to the signaling server, then authenticates it.
   * @param url The WebSocket URL of the signaling server.
   * @param opts Optional configuration for the test client.
   * @returns A promise that resolves to the connected and authenticated TestClient instance.
   */
  static async createConnected(url: string, opts: TestClientOptions = {}): Promise<TestClient> {
    const client = await TestClient.connect(url);
    await client.authenticate(opts);
    return client;
  }

  sendRaw(data: unknown): void {
    if (this.closed) {
      throw new Error("Cannot send on closed WebSocket");
    }
    this.ws.send(JSON.stringify(data));
  }

  send(type: MessageType, payload: Record<string, unknown>): void {
    this.sendRaw({ type, from: this.peerId, payload });
  }

  sendTo(type: MessageType, to: PeerId, payload: Record<string, unknown>): void {
    this.sendRaw({ type, from: this.peerId, to, payload });
  }

  /**
   * Receives a message of the specified type from the signaling server.
   * If a message of that type has already been received, it is returned immediately.
   * Otherwise, this method waits for a message of that type to arrive or times out after the specified duration.
   * @param type The type of message to wait for.
   * @param timeoutMs The maximum time to wait for the message in milliseconds (default: 3000ms).
   * @returns A promise that resolves to the received ServerMessage.
   */
  async receive<T extends ServerMessage = ServerMessage>(
    type: string,
    timeoutMs = 3000,
  ): Promise<T> {
    const existing = this.received.findIndex((m) => m.type === type);
    if (existing !== -1) {
      return this.received.splice(existing, 1)[0] as T;
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup(type, listener);
        reject(new Error(`Timeout waiting for message type "${type}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (msg: ServerMessage) => {
        clearTimeout(timeout);
        resolve(msg as T);
      };

      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type)!.push(listener);
    });
  }

  /**
   * Receives a message of the specified type that matches the provided predicate function.
   * If a matching message has already been received, it is returned immediately.
   * Otherwise, this method waits for a matching message to arrive or times out after the specified duration.
   * @param type The type of message to wait for.
   * @param predicate A function that takes a ServerMessage and returns true if it matches the desired criteria.
   * @param timeoutMs The maximum time to wait for the message in milliseconds (default: 3000ms).
   * @returns A promise that resolves to the received ServerMessage that matches the predicate.
   */
  async receiveExactly(
    type: string,
    predicate: (msg: ServerMessage) => boolean,
    timeoutMs = 3000,
  ): Promise<ServerMessage> {
    const existing = this.received.findIndex((m) => m.type === type && predicate(m));
    if (existing !== -1) {
      return this.received.splice(existing, 1)[0];
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const check = (msg: ServerMessage) => {
        if (msg.type === type && predicate(msg)) {
          clearTimeout(timeout);
          this.cleanup(type, check);
          resolve(msg);
        }
      };

      const timeout = setTimeout(() => {
        this.cleanup(type, check);
        reject(
          new Error(`Timeout waiting for matched message type "${type}" after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type)!.push(check);
    });
  }

  /**
   * Waits for a message that matches the provided predicate function, regardless of its type.
   * If a matching message has already been received, it is returned immediately.
   * Otherwise, this method waits for a matching message to arrive or times out after the specified duration.
   * @param predicate A function that takes a ServerMessage and returns true if it matches the desired criteria.
   * @param timeoutMs The maximum time to wait for the message in milliseconds (default: 3000ms).
   * @returns A promise that resolves to the received ServerMessage that matches the predicate.
   */
  async waitForMessage(
    predicate: (msg: ServerMessage) => boolean,
    timeoutMs = 3000,
  ): Promise<ServerMessage> {
    const existing = this.received.findIndex(predicate);
    if (existing !== -1) {
      return this.received.splice(existing, 1)[0];
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for matching message after ${timeoutMs}ms`));
      }, timeoutMs);

      const catchAll = (msg: ServerMessage) => {
        if (predicate(msg)) {
          clearTimeout(timeout);
          this.cleanup("*", catchAll);
          resolve(msg);
        }
      };

      this.listeners.set("*", [...(this.listeners.get("*") ?? []), catchAll]);
    });
  }

  async receiveError(timeoutMs = 3000): Promise<SignalingErrorCode> {
    const msg = await this.receive<ErrorMessage>("error", timeoutMs);
    return msg.payload.code as SignalingErrorCode;
  }

  /**
   * Waits for the WebSocket connection to close and returns the close code and reason.
   * If the connection does not close within the specified timeout, an error is thrown.
   * @param timeoutMs The maximum time to wait for the connection to close in milliseconds (default: 3000ms).
   * @returns A promise that resolves to an object containing the close code and reason.
   */
  async expectClose(timeoutMs = 3000): Promise<{ code: number; reason: string }> {
    const result = await Promise.race([
      this.closePromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout waiting for close after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
    return result;
  }

  /**
   * Closes the WebSocket connection to the signaling server.
   */
  close(): void {
    this.ws.close();
  }

  private cleanup(type: string, listener: (msg: ServerMessage) => void): void {
    if (type === "*") {
      const all = this.listeners.get("*");
      if (all) {
        this.listeners.set(
          "*",
          all.filter((l) => l !== listener),
        );
      }
    } else {
      const listeners = this.listeners.get(type);
      if (listeners) {
        this.listeners.set(
          type,
          listeners.filter((l) => l !== listener),
        );
      }
    }
  }
}
