export class Queue<T> {
  private items: T[] = [];
  private head = 0;

  enqueue(...items: T[]) {
    this.items.push(...items);
  }

  dequeue(): T | undefined {
    if (this.head >= this.items.length) {
      return undefined;
    }

    const item = this.items[this.head++];

    if (this.head > 64 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }

    return item;
  }

  peek(): T | undefined {
    return this.items[this.head];
  }

  get size() {
    return this.items.length - this.head;
  }

  get isEmpty() {
    return this.size === 0;
  }
}
