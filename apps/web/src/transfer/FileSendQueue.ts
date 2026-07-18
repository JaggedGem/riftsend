import { TypedEventEmitter } from "@/events/TypedEventEmitter";
import { Queue } from "@/queue/Queue";

type FileSendQueueEvents = {
  available: void;
};

export class FileSendQueue<T> extends TypedEventEmitter<FileSendQueueEvents> {
  private queue = new Queue<T>();

  enqueue(...items: T[]): void {
    const wasEmpty = this.queue.isEmpty;

    this.queue.enqueue(...items);

    if (wasEmpty && !this.queue.isEmpty) {
      this.emit("available", undefined);
    }
  }

  dequeue(): T | undefined {
    return this.queue.dequeue();
  }

  peek(): T | undefined {
    return this.queue.peek();
  }

  get size() {
    return this.queue.size;
  }

  get isEmpty() {
    return this.queue.isEmpty;
  }
}
