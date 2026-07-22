type EventHandler<T> = T extends void ? () => void : (payload: T) => void;

type BaseEvents = { error: unknown };

type WithBaseEvents<EventMap extends Record<string, unknown>> = EventMap & BaseEvents;

export abstract class TypedEventEmitter<EventMap extends Record<string, unknown>> {
  private listeners: {
    [K in keyof WithBaseEvents<EventMap>]?: Set<EventHandler<WithBaseEvents<EventMap>[K]>>;
  } = {};

  clearAll(): void {
    this.listeners = {};
  }

  clear<K extends keyof WithBaseEvents<EventMap>>(type: K): void {
    delete this.listeners[type];
  }

  on<K extends keyof WithBaseEvents<EventMap>>(
    type: K,
    handler: EventHandler<WithBaseEvents<EventMap>[K]>,
  ): () => void {
    this.listeners[type] ??= new Set();
    this.listeners[type]!.add(handler);

    return () => this.off(type, handler);
  }

  off<K extends keyof WithBaseEvents<EventMap>>(
    type: K,
    handler: EventHandler<WithBaseEvents<EventMap>[K]>,
  ): void {
    this.listeners[type]?.delete(handler);
  }

  protected emit<K extends keyof WithBaseEvents<EventMap>>(
    type: K,
    payload: WithBaseEvents<EventMap>[K],
  ): void {
    this.listeners[type]?.forEach((handler) => {
      handler(payload);
    });
  }
}
