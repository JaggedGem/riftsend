import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileId } from "@riftsend/shared";
import { OpfsSinkWorkerClient } from "./OpfsSinkWorkerClient.js";

class FakeWorker {
  public static instances: FakeWorker[] = [];

  private readonly listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  public constructor() {
    FakeWorker.instances.push(this);
  }

  public addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  public removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  public postMessage(message: { requestId: number; type: string }) {
    queueMicrotask(() => {
      const response = {
        type: "success",
        requestId: message.requestId,
        result:
          message.type === "read"
            ? new Uint8Array([1, 2, 3, 4]).buffer
            : message.type === "getSize"
              ? 64
              : undefined,
      };

      this.listeners
        .get("message")
        ?.forEach((listener) => listener({ data: response } as MessageEvent));
    });
  }

  public terminate() {
    // no-op for tests
  }
}

describe("OpfsSinkWorkerClient", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal("Worker", FakeWorker);
    Object.assign(import.meta.env, {
      BUFFER_THRESHOLD_MIN_BYTES: "1024",
      BUFFER_THRESHOLD_MAX_BYTES: "65536",
      BUFFER_THRESHOLD_MIN_TIME_MS: "50",
      BUFFER_THRESHOLD_MAX_TIME_MS: "500",
      ASSUMED_MIN_THROUGHPUT: "1024",
      FLUSH_THRESHOLD_PERCENTAGE_OF_FILE_SIZE: "25",
      FLUSH_CYCLES_OF_BACKLOG: "3",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes and successfully performs read and size operations", async () => {
    const client = new OpfsSinkWorkerClient();

    await client.initialize("123e4567-e89b-42d3-a456-426614174000" as FileId, 2048, false);

    const size = await client.getSize();
    const bytes = await client.read(0, 4);

    expect(FakeWorker.instances).toHaveLength(1);
    expect(size).toBe(64);
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(client.lastError).toBeUndefined();
  });

  it("supports write operations and resolves the buffered write promise", async () => {
    const client = new OpfsSinkWorkerClient();

    await client.initialize("123e4567-e89b-42d3-a456-426614174001" as FileId, 4096, false);

    const { buffered } = await client.write(0, new Uint8Array([9, 8, 7]).buffer);

    await expect(buffered).resolves.toBeUndefined();
    expect(client.lastError).toBeUndefined();
  });
});
