import { ShopEventsService } from './shop-events.service';

describe('ShopEventsService', () => {
  it('broadcasts events only to subscribers of the matching shop and cleans up on unsubscribe', () => {
    const service = new ShopEventsService();
    const shop1Events: string[] = [];
    const shop2Events: string[] = [];

    const unsub1 = service.subscribe('shop-1', (payload) => {
      shop1Events.push(payload.type);
    });
    const unsub2 = service.subscribe('shop-2', (payload) => {
      shop2Events.push(payload.type);
    });

    service.emit('shop-1', 'receiving.updated');
    service.emit('shop-1', 'inventory.updated');
    service.emit('shop-2', 'sale.updated');

    expect(shop1Events).toEqual(['receiving.updated', 'inventory.updated']);
    expect(shop2Events).toEqual(['sale.updated']);

    unsub1();
    service.emit('shop-1', 'catalog.updated');
    expect(shop1Events).toEqual(['receiving.updated', 'inventory.updated']);

    unsub2();
  });
});
