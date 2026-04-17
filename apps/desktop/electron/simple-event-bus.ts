export interface SimpleEventBus {
  emit(channel: string, data: unknown): void;
  on(channel: string, handler: (data: unknown) => void): () => void;
  clear(): void;
}

export function createSimpleEventBus(): SimpleEventBus {
  const listeners = new Map<string, Set<(data: unknown) => void>>();

  return {
    emit(channel, data) {
      const handlers = listeners.get(channel);
      if (!handlers) {
        return;
      }

      for (const handler of [...handlers]) {
        handler(data);
      }
    },
    on(channel, handler) {
      const handlers = listeners.get(channel) ?? new Set<(data: unknown) => void>();
      handlers.add(handler);
      listeners.set(channel, handlers);
      return () => {
        const current = listeners.get(channel);
        if (!current) {
          return;
        }
        current.delete(handler);
        if (current.size === 0) {
          listeners.delete(channel);
        }
      };
    },
    clear() {
      listeners.clear();
    },
  };
}
