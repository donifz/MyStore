import { useEffect, useRef } from 'react';

export type ShopLiveEventType =
  | 'inventory.updated'
  | 'catalog.updated'
  | 'receiving.updated'
  | 'sale.updated';

export function useShopLiveSync(
  shopId: string | undefined,
  eventTypes: ShopLiveEventType[],
  onRefresh: () => void,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const eventTypesKey = eventTypes.join(',');

  useEffect(() => {
    if (!shopId) return;

    let source: EventSource | null = null;
    let debounceTimer: number | null = null;
    let lastVisibleRefreshAt = Date.now();
    const types = eventTypesKey
      ? (eventTypesKey.split(',') as ShopLiveEventType[])
      : [];

    const triggerRefresh = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        lastVisibleRefreshAt = Date.now();
        onRefreshRef.current();
      }, 350);
    };

    const connect = () => {
      if (source || typeof EventSource === 'undefined') return;
      if (document.visibilityState === 'hidden') return;
      source = new EventSource(`/api/shops/${shopId}/events`, {
        withCredentials: true,
      });
      for (const type of types) {
        source.addEventListener(type, triggerRefresh);
      }
    };

    const disconnect = () => {
      if (!source) return;
      source.close();
      source = null;
    };

    const handleVisible = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
        return;
      }
      connect();
      const now = Date.now();
      if (now - lastVisibleRefreshAt > 1500) {
        lastVisibleRefreshAt = now;
        onRefreshRef.current();
      }
    };

    const handleFocus = () => {
      if (document.visibilityState === 'hidden') return;
      connect();
      const now = Date.now();
      if (now - lastVisibleRefreshAt > 1500) {
        lastVisibleRefreshAt = now;
        onRefreshRef.current();
      }
    };

    connect();
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      disconnect();
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, [shopId, eventTypesKey]);
}
