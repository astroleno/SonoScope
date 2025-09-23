import { Transport } from '../types';

export class WorkerTransport implements Transport {
  private worker: Worker | null = null;
  private handlers = new Map<string, Set<(data: any) => void>>();
  private messageQueue: Array<{ type: string; data: any }> = [];

  constructor(workerScript?: string) {
    if (workerScript) {
      this.worker = new Worker(workerScript);
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    }
  }

  send(type: string, data: any): void {
    const message = { type, data };
    
    if (this.worker) {
      this.worker.postMessage(message);
    } else {
      // Queue messages if worker not ready
      this.messageQueue.push(message);
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

  private handleMessage(event: MessageEvent): void {
    const { type, data } = event.data;
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Worker transport handler error:', error);
        }
      });
    }
  }

  private handleError(error: ErrorEvent): void {
    console.error('Worker transport error:', error);
    const errorHandlers = this.handlers.get('error');
    if (errorHandlers) {
      errorHandlers.forEach(handler => handler(error));
    }
  }

  setWorker(worker: Worker): void {
    this.worker = worker;
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);
    
    // Send queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.worker.postMessage(message);
    }
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.handlers.clear();
    this.messageQueue = [];
  }
}
