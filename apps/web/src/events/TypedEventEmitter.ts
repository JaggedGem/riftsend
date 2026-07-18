export type EventHandler<T> = (payload: T) => void;

export abstract class TypedEventEmitter<EventMap extends Record<string, unknown>> {
  private listeners: {
    [K in keyof EventMap]?: Set<EventHandler<EventMap[K]>>;
  } = {};

  clearAll(): void {
    this.listeners = {};
  }

  clear<K extends keyof EventMap>(type: K): void {
    delete this.listeners[type];
  }

  on<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): () => void {
    this.listeners[type] ??= new Set();
    this.listeners[type]!.add(handler);

    return () => this.off(type, handler);
  }

  off<K extends keyof EventMap>(type: K, handler: EventHandler<EventMap[K]>): void {
    this.listeners[type]?.delete(handler);
  }

  protected emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    this.listeners[type]?.forEach((handler) => {
      handler(payload);
    });
  }
}
