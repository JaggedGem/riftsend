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

  private invokeHandlers<T>(handlers: Iterable<EventHandler<T>>, payload: T): readonly unknown[] {
    const errors: unknown[] = [];

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        errors.push(error);
      }
    }

    return errors;
  }

  protected emit<K extends keyof WithBaseEvents<EventMap>>(
    type: K,
    payload: WithBaseEvents<EventMap>[K],
  ): void {
    const listeners = this.listeners[type];

    if (!listeners) {
      return;
    }

    const errors = this.invokeHandlers([...listeners], payload);

    if (errors.length > 0) {
      queueMicrotask(() => {
        throw new AggregateError(errors, `Event "${String(type)}" handler execution failed`);
      });
    }
  }
}
