import { describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "./TypedEventEmitter.js";

type TestEvents = {
  ping: string;
  ready: void;
  count: number;
};

class TestEmitter extends TypedEventEmitter<TestEvents> {
  public emitEvent<K extends keyof TestEvents>(type: K, payload?: TestEvents[K]): void {
    if (type === "ready") {
      return this.emit("ready");
    }

    return this.emit(type, payload as never);
  }
}

describe("TypedEventEmitter", () => {
  it("registers and emits payload handlers", () => {
    const emitter = new TestEmitter();
    const handler = vi.fn();

    emitter.on("ping", handler);
    emitter.emitEvent("ping", "hello");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("supports void events and removes listeners cleanly", () => {
    const emitter = new TestEmitter();
    const listener = vi.fn();
    const unsub = emitter.on("ready", listener);

    emitter.emitEvent("ready");
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    emitter.emitEvent("ready");
    expect(listener).toHaveBeenCalledTimes(1);

    emitter.clear("ready");
    emitter.emitEvent("ready");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears all listeners and ignores missing handler calls", () => {
    const emitter = new TestEmitter();
    const ping = vi.fn();
    const count = vi.fn();

    emitter.on("ping", ping);
    emitter.on("count", count);
    emitter.clearAll();

    emitter.emitEvent("ping", "gone");
    emitter.emitEvent("count", 42);

    expect(ping).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it("queues an async rethrow when a listener throws", () => {
    const emitter = new TestEmitter();
    const bad = vi.fn(() => {
      throw new Error("bad handler");
    });

    emitter.on("count", bad);

    const queueMicrotaskSpy = vi.spyOn(globalThis, "queueMicrotask").mockImplementation(() => {});

    expect(() => emitter.emitEvent("count", 7)).not.toThrow();
    expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);

    queueMicrotaskSpy.mockRestore();
  });
});
