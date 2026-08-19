import { describe, expect, it, vi } from "vitest";
import { NotifyingQueue } from "./NotifyingQueue.js";

describe("NotifyingQueue", () => {
  it("emits available when transitioning from empty to non-empty", () => {
    const queue = new NotifyingQueue<number>();
    const listener = vi.fn();

    queue.on("available", listener);
    queue.enqueue(1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.dequeue()).toBe(1);
  });

  it("does not emit available when enqueueing more items to a non-empty queue", () => {
    const queue = new NotifyingQueue<number>();
    const listener = vi.fn();

    queue.on("available", listener);
    queue.enqueue(1);
    queue.enqueue(2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(2);
  });
});
