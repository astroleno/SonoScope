import { Transport } from '../types';

export class MemoryTransport implements Transport {
  private handlers = new Map<string, Set<(data: any) => void>>();

  send(type: string, data: any): void {
    // Synchronous dispatch for same-thread communication
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Memory transport handler error:', error);
        }
      });
    }
  }

  on(type: string, handler: (data: any) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: (data: any) => void): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  dispose(): void {
    this.handlers.clear();
  }
}
