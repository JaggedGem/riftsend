import { WebSocket } from "ws";
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

export class TestClient {
  public peerId!: PeerId;
  public sessionToken!: SessionToken;
  private received: ServerMessage[] = [];
  private listeners = new Map<string, Array<(msg: ServerMessage) => void>>();
  private closed = false;
  private closePromise: Promise<{ code: number; reason: string }>;
  private resolveClose!: (value: { code: number; reason: string }) => void;

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

  static async connect(url: string, opts: TestClientOptions = {}): Promise<TestClient> {
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

  async authenticate(opts: TestClientOptions = {}): Promise<void> {
    const helloMsg = {
      type: "hello",
      from: null,
      protocolVersion: opts.protocolVersion ?? 1,
      clientVersion: opts.clientVersion ?? "1.0.0",
      sessionToken: null,
      payload: {
        role: opts.role ?? "sender",
        name: opts.name ?? "test-client",
        platform: opts.platform ?? "test",
        supportResume: opts.supportResume ?? false,
        supportChunkAck: opts.supportChunkAck ?? false,
      },
    };

    this.sendRaw(helloMsg);

    const peerIdMsg = await this.receive("peer-id");
    this.peerId = peerIdMsg.payload.peerId as PeerId;
    this.sessionToken = peerIdMsg.payload.sessionToken as SessionToken;
  }

  static async createConnected(url: string, opts: TestClientOptions = {}): Promise<TestClient> {
    const client = await TestClient.connect(url, opts);
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

  async receive(type: string, timeoutMs = 3000): Promise<ServerMessage> {
    const existing = this.received.findIndex((m) => m.type === type);
    if (existing !== -1) {
      return this.received.splice(existing, 1)[0];
    }

    return new Promise<ServerMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup(type, listener);
        reject(new Error(`Timeout waiting for message type "${type}" after ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (msg: ServerMessage) => {
        clearTimeout(timeout);
        resolve(msg);
      };

      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type)!.push(listener);
    });
  }

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
    const msg = await this.receive("error", timeoutMs);
    return msg.payload.code as SignalingErrorCode;
  }

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
