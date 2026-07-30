import { TypedEventEmitter } from "@/events/TypedEventEmitter.js";
import { Queue } from "@/queue/Queue.js";

type NotifyingQueueEvents = {
  available: void;
};

export class NotifyingQueue<T> extends TypedEventEmitter<NotifyingQueueEvents> {
  private queue = new Queue<T>();

  public enqueue(...items: T[]): void {
    const wasEmpty = this.queue.isEmpty;

    this.queue.enqueue(...items);

    if (wasEmpty && !this.queue.isEmpty) {
      this.emit("available");
    }
  }

  public dequeue(): T | undefined {
    return this.queue.dequeue();
  }

  public peek(): T | undefined {
    return this.queue.peek();
  }

  public get size() {
    return this.queue.size;
  }

  public get isEmpty() {
    return this.queue.isEmpty;
  }
}
