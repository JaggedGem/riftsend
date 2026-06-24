import { createServer } from "../index.js";
import { resetPeerState } from "../peer.js";
import { resetRoomState } from "../handlers/rooms.js";
import { TestClient, type TestClientOptions } from "./testClient.js";

export class TestHarness {
  public httpPort!: number;
  public wsPort!: number;
  public httpUrl!: string;
  public wsUrl!: string;
  private _stop!: () => Promise<void>;
  private clients: TestClient[] = [];

  private constructor() {}

  static async create(overrides?: {
    heartbeatMs?: number;
    connectionTimeoutMs?: number;
  }): Promise<TestHarness> {
    const h = new TestHarness();
    const server = await createServer({
      httpPort: 0,
      wsPort: 0,
      heartbeatMs: overrides?.heartbeatMs ?? 60_000,
      connectionTimeoutMs: overrides?.connectionTimeoutMs ?? 1000,
    });

    h.httpPort = server.httpPort;
    h.wsPort = server.wsPort;
    h.httpUrl = `http://127.0.0.1:${server.httpPort}`;
    h.wsUrl = `ws://127.0.0.1:${server.wsPort}`;
    h._stop = server.stop;

    return h;
  }

  async createClient(opts: TestClientOptions = {}): Promise<TestClient> {
    const client = await TestClient.createConnected(this.wsUrl, opts);
    this.clients.push(client);
    return client;
  }

  async rawClient(opts: TestClientOptions = {}): Promise<TestClient> {
    const client = await TestClient.connect(this.wsUrl, opts);
    this.clients.push(client);
    return client;
  }

  async httpGet(path: string): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${this.httpUrl}${path}`);
    return {
      status: res.status,
      body: await res.json(),
    };
  }

  async shutdown(): Promise<void> {
    for (const c of this.clients) {
      try {
        c.close();
      } catch {
        // ignore close errors
      }
    }
    this.clients = [];
    await this._stop();
    resetPeerState();
    resetRoomState();
  }
}
