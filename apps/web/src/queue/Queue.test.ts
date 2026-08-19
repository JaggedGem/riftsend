import { describe, expect, it } from "vitest";
import { Queue } from "./Queue.js";

describe("Queue", () => {
  it("enqueues and dequeues items in FIFO order", () => {
    const queue = new Queue<number>();

    queue.enqueue(1, 2, 3);

    expect(queue.size).toBe(3);
    expect(queue.isEmpty).toBe(false);
    expect(queue.dequeue()).toBe(1);
    expect(queue.peek()).toBe(2);
    expect(queue.dequeue()).toBe(2);
    expect(queue.dequeue()).toBe(3);
    expect(queue.dequeue()).toBeUndefined();
    expect(queue.isEmpty).toBe(true);
  });

  it("compacts the internal array after the head advances far enough", () => {
    const queue = new Queue<number>();

    for (let i = 0; i < 200; i++) {
      queue.enqueue(i);
    }

    for (let i = 0; i < 130; i++) {
      queue.dequeue();
    }

    expect(queue.size).toBe(70);
    expect(queue.peek()).toBe(130);
    expect(queue.dequeue()).toBe(130);
    expect(queue.peek()).toBe(131);
  });
});
