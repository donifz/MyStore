import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, act } from '@testing-library/react';
import { useShopLiveSync } from './use-shop-live-sync';

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, Set<() => void>>();
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  close() {
    this.closed = true;
  }
}

afterEach(() => {
  cleanup();
  MockEventSource.instances = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Harness({
  shopId,
  onRefresh,
}: {
  shopId: string;
  onRefresh: () => void;
}) {
  useShopLiveSync(
    shopId,
    ['inventory.updated', 'receiving.updated'],
    onRefresh,
  );
  return null;
}

it('subscribes to shop SSE, debounces burst events, and disconnects when hidden', () => {
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', MockEventSource);
  const onRefresh = vi.fn();

  render(<Harness shopId="shop-1" onRefresh={onRefresh} />);

  expect(MockEventSource.instances).toHaveLength(1);
  const source = MockEventSource.instances[0];
  expect(source.url).toBe('/api/shops/shop-1/events');

  act(() => {
    source.emit('receiving.updated');
    source.emit('inventory.updated');
    vi.advanceTimersByTime(350);
  });
  expect(onRefresh).toHaveBeenCalledTimes(1);

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(source.closed).toBe(true);

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  act(() => {
    vi.advanceTimersByTime(2000);
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(MockEventSource.instances).toHaveLength(2);
  expect(onRefresh).toHaveBeenCalledTimes(2);
});
