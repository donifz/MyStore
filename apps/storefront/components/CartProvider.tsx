'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import Link from 'next/link';
import type { Product } from '../lib/public-api';
export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  storeSlug: string;
  storeName: string;
};
const cartStorage = 'mystore-cart-v1',
  keyStorage = 'mystore-checkout-key';
function valid(items: unknown): items is CartItem[] {
  if (!Array.isArray(items) || items.length > 100) return false;
  const ids = new Set<string>();
  let total = 0n;
  for (const l of items) {
    if (
      !l ||
      typeof l.id !== 'string' ||
      !/^[\da-f-]{36}$/i.test(l.id) ||
      ids.has(l.id) ||
      typeof l.name !== 'string' ||
      l.name.length > 200 ||
      typeof l.storeSlug !== 'string' ||
      l.storeSlug.length > 80 ||
      typeof l.storeName !== 'string' ||
      l.storeName.length > 200 ||
      !Number.isSafeInteger(l.price) ||
      l.price < 0 ||
      !Number.isSafeInteger(l.quantity) ||
      l.quantity < 1 ||
      l.quantity > 1000000 ||
      l.storeSlug !== items[0].storeSlug
    )
      return false;
    ids.add(l.id);
    total += BigInt(l.price) * BigInt(l.quantity);
  }
  return total <= BigInt(Number.MAX_SAFE_INTEGER);
}
type Cart = {
  items: CartItem[];
  ready: boolean;
  error: string;
  checkoutKey: string;
  setKey: (key: string) => void;
  add: (p: Product, replace?: boolean) => boolean;
  quantity: (id: string, n: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};
const Context = createContext<Cart | null>(null);
export function useCart() {
  const v = useContext(Context);
  if (!v) throw Error('CartProvider missing');
  return v;
}
export default function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [checkoutKey, keyState] = useState('');
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(cartStorage) ?? '[]');
      if (!valid(stored))
        throw Error('Корзина повреждена. Очистите её и добавьте товары снова.');
      setItems(stored);
      const key = sessionStorage.getItem(keyStorage) ?? '';
      if (/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key))
        keyState(key);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Не удалось прочитать корзину.',
      );
    }
    setReady(true);
  }, []);
  function update(next: CartItem[]) {
    if (!valid(next)) {
      setError('Проверьте количество и сумму корзины.');
      return false;
    }
    try {
      localStorage.setItem(cartStorage, JSON.stringify(next));
      setItems(next);
      setError('');
      return true;
    } catch {
      setError(
        'Не удалось сохранить корзину. Разрешите хранение данных в браузере.',
      );
      return false;
    }
  }
  function setKey(key: string) {
    if (key) sessionStorage.setItem(keyStorage, key);
    else sessionStorage.removeItem(keyStorage);
    keyState(key);
  }
  function add(p: Product, replace = false) {
    if (!ready || checkoutKey || p.available < 1) return false;
    if (items.length && items[0].storeSlug !== p.store.slug && !replace)
      return false;
    const base = replace ? [] : items,
      existing = base.find((l) => l.id === p.id);
    const next = existing
      ? base.map((l) =>
          l.id === p.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      : [
          ...base,
          {
            id: p.id,
            name: p.name,
            price: p.salePriceMinor,
            quantity: 1,
            storeSlug: p.store.slug,
            storeName: p.store.name,
          },
        ];
    return update(next);
  }
  return (
    <Context.Provider
      value={{
        items,
        ready,
        error,
        checkoutKey,
        setKey,
        add,
        quantity: (id, n) => {
          if (Number.isSafeInteger(n) && n > 0)
            update(items.map((l) => (l.id === id ? { ...l, quantity: n } : l)));
        },
        remove: (id) => {
          update(items.filter((l) => l.id !== id));
        },
        clear: () => {
          update([]);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function CartLink() {
  const c = useCart();
  return (
    <Link href="/cart">
      Корзина
      {c.ready && c.items.length
        ? ` (${c.items.reduce((n, l) => n + l.quantity, 0)})`
        : ''}
    </Link>
  );
}
