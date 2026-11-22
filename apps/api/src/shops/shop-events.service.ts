import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

export type ShopEventType =
  | 'inventory.updated'
  | 'catalog.updated'
  | 'receiving.updated'
  | 'sale.updated'
  | 'print-job';

export type ShopEventPayload = {
  type: ShopEventType;
  shopId: string;
  timestamp: number;
};

@Injectable()
export class ShopEventsService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(shopId: string, type: ShopEventType) {
    const payload: ShopEventPayload = {
      type,
      shopId,
      timestamp: Date.now(),
    };
    this.emitter.emit(this.channel(shopId), payload);
  }

  subscribe(
    shopId: string,
    listener: (payload: ShopEventPayload) => void,
  ): () => void {
    const channel = this.channel(shopId);
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  private channel(shopId: string) {
    return `shop:${shopId}`;
  }
}
