import { createServer } from "../index.js";
import { resetPeerState } from "../peer.js";
import { resetRoomState } from "../handlers/rooms.js";
import { TestClient, type TestClientOptions } from "./testClient.js";

/**
 * A test harness for the signaling server.
 * This class provides methods to create a server instance, manage test clients, and perform HTTP requests.
 */
export class TestHarness {
  public httpPort!: number;
  public wsPort!: number;
  public httpUrl!: string;
  public wsUrl!: string;
  private _stop!: () => Promise<void>;
  private clients: TestClient[] = [];

  private constructor() {}

  /**
   * Creates a new test harness instance with an optional configuration override.
   * @param overrides Optional configuration overrides for heartbeat and connection timeout.
   * @returns A promise that resolves to the created TestHarness instance.
   */
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

  /**
   * Creates and connects a new test client to the signaling server.
   * @param opts Optional configuration for the test client.
   * @returns A promise that resolves to the connected TestClient instance.
   */
  async createClient(opts: TestClientOptions = {}): Promise<TestClient> {
    const client = await TestClient.createConnected(this.wsUrl, opts);
    this.clients.push(client);
    return client;
  }

  /**
   * Creates and connects a new raw test client to the signaling server.
   * @returns A promise that resolves to the connected TestClient instance.
   */
  async rawClient(): Promise<TestClient> {
    const client = await TestClient.connect(this.wsUrl);
    this.clients.push(client);
    return client;
  }

  /**
   * Performs an HTTP GET request to the specified path on the signaling server.
   * @param path The path to send the GET request to.
   * @returns A promise that resolves to an object containing the response status and body.
   */
  async httpGet(path: string): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${this.httpUrl}${path}`);
    return {
      status: res.status,
      body: await res.json(),
    };
  }

  /**
   * Shuts down the test harness, closing all connected clients and stopping the server.
   * This method also resets the peer and room state to ensure a clean environment for subsequent tests.
   * @returns A promise that resolves when the shutdown process is complete.
   */
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
