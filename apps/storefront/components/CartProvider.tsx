'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import Link from 'next/link';
import type { Product } from '../lib/public-api';
import Icon from './storefront/Icon';
export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  storeSlug: string;
  storeName: string;
  photoUrl?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
};
export type OrderBody = {
  checkoutKey: string;
  storeSlug: string;
  name: string;
  phone: string;
  email?: string;
  fulfillment: 'pickup' | 'delivery';
  address: string;
  comment: string;
  lines: {
    variantId: string;
    quantity: number;
    expectedUnitPriceMinor: number;
  }[];
};
export type Receipt = {
  checkoutKey?: string;
  id: string;
  status: string;
  totalMinor: number;
  expiresAt: string | null;
  storeName: string;
};
export type CartState = {
  items: CartItem[];
  attempts: Record<string, OrderBody>;
  receipts: Receipt[];
};
const storage = 'mystore-marketplace-cart-v2',
  legacyKey = 'mystore-checkout-key';
const empty = (): CartState => ({ items: [], attempts: {}, receipts: [] });
function valid(s: CartState) {
  if (
    !s ||
    !Array.isArray(s.items) ||
    s.items.length > 100 ||
    !s.attempts ||
    typeof s.attempts !== 'object' ||
    Array.isArray(s.attempts) ||
    !Array.isArray(s.receipts)
  )
    return false;
  const ids = new Set<string>();
  let total = 0n;
  for (const l of s.items) {
    if (
      !l ||
      typeof l.id !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(l.id) ||
      ids.has(l.id) ||
      typeof l.name !== 'string' ||
      l.name.length > 200 ||
      typeof l.storeSlug !== 'string' ||
      !l.storeSlug ||
      l.storeSlug.length > 80 ||
      typeof l.storeName !== 'string' ||
      !Number.isSafeInteger(l.price) ||
      l.price < 0 ||
      !Number.isSafeInteger(l.quantity) ||
      l.quantity < 1 ||
      l.quantity > 1000000
    )
      return false;
    ids.add(l.id);
    total += BigInt(l.price) * BigInt(l.quantity);
  }
  for (const [slug, b] of Object.entries(s.attempts)) {
    if (
      !b ||
      b.storeSlug !== slug ||
      typeof b.checkoutKey !== 'string' ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(b.checkoutKey) ||
      !Array.isArray(b.lines) ||
      !b.lines.length ||
      b.lines.length > 100 ||
      typeof b.name !== 'string' ||
      typeof b.phone !== 'string' ||
      !['pickup', 'delivery'].includes(b.fulfillment)
    )
      return false;
  }
  return (
    total <= BigInt(Number.MAX_SAFE_INTEGER) &&
    s.receipts.every(
      (x) =>
        x &&
        typeof x.id === 'string' &&
        typeof x.storeName === 'string' &&
        Number.isSafeInteger(x.totalMinor) &&
        x.totalMinor >= 0,
    )
  );
}
type Cart = {
  items: CartItem[];
  state: CartState;
  ready: boolean;
  error: string;
  checkoutKey: string;
  setKey: (key: string) => void;
  add: (p: Product, replace?: boolean, quantity?: number) => boolean;
  quantity: (id: string, n: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  latest: () => CartState;
  save: (s: CartState) => void;
};
const Context = createContext<Cart | null>(null);
export function useCart() {
  const c = useContext(Context);
  if (!c) throw Error('CartProvider missing');
  return c;
}
export default function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(empty),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [checkoutKey, keyState] = useState('');
  const ref = useRef(state);
  function latest() {
    const raw = localStorage.getItem(storage);
    const next = raw ? JSON.parse(raw) : ref.current;
    if (!valid(next))
      throw Error(
        'Не удалось прочитать корзину. Данные сохранены для восстановления.',
      );
    ref.current = next;
    return next;
  }
  function save(next: CartState) {
    if (!valid(next)) throw Error('Проверьте количество и сумму корзины.');
    localStorage.setItem(storage, JSON.stringify(next));
    ref.current = next;
    setState(next);
    setError('');
  }
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storage);
      const s = raw
        ? JSON.parse(raw)
        : {
            ...empty(),
            items: JSON.parse(localStorage.getItem('mystore-cart-v1') || '[]'),
          };
      if (!valid(s))
        throw Error('Корзина повреждена. Сохранённые данные не изменены.');
      ref.current = s;
      setState(s);
      const k = sessionStorage.getItem(legacyKey) || '';
      if (/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(k)) keyState(k);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Не удалось прочитать корзину.',
      );
    }
    setReady(true);
    const sync = () => {
      try {
        setState(latest());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка корзины.');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function update(fn: (s: CartState) => CartState) {
    try {
      save(fn(latest()));
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Не удалось сохранить корзину.',
      );
      return false;
    }
  }
  function add(p: Product, _replace = false, quantity = 1) {
    if (
      !ready ||
      checkoutKey ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > p.available
    )
      return false;
    return update((s) => {
      if (s.attempts[p.store.slug])
        throw Error('Сначала проверьте оформляемый заказ этого магазина.');
      const current = s.items.find((l) => l.id === p.id);
      if ((current?.quantity || 0) + quantity > p.available)
        throw Error('Выбрано больше, чем есть в наличии.');
      const line: CartItem = {
        id: p.id,
        name: p.name,
        price: p.salePriceMinor,
        quantity: (current?.quantity || 0) + quantity,
        storeSlug: p.store.slug,
        storeName: p.store.name,
        photoUrl: p.photoUrl,
        pickupEnabled: p.store.pickupEnabled,
        deliveryEnabled: p.store.deliveryEnabled,
      };
      return {
        ...s,
        items: current
          ? s.items.map((l) => (l.id === p.id ? line : l))
          : [...s.items, line],
      };
    });
  }
  return (
    <Context.Provider
      value={{
        items: state.items,
        state,
        ready,
        error,
        checkoutKey,
        latest,
        save,
        setKey: (k) => {
          if (k) sessionStorage.setItem(legacyKey, k);
          else sessionStorage.removeItem(legacyKey);
          keyState(k);
        },
        add,
        quantity: (id, n) => {
          if (checkoutKey) return;
          update((s) => ({
            ...s,
            items: s.items.map((l) =>
              l.id === id && !s.attempts[l.storeSlug]
                ? { ...l, quantity: n }
                : l,
            ),
          }));
        },
        remove: (id) => {
          if (checkoutKey) return;
          update((s) => ({
            ...s,
            items: s.items.filter(
              (l) => l.id !== id || s.attempts[l.storeSlug],
            ),
          }));
        },
        clear: () => {
          update((s) => ({
            ...s,
            items: s.items.filter((l) => s.attempts[l.storeSlug]),
          }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function CartLink() {
  const c = useCart();
  const n = c.items.reduce((a, l) => a + l.quantity, 0);
  return (
    <Link href="/cart" className="sf-cart-link">
      <Icon name="cart" />
      <span>Корзина</span>
      {c.ready && n > 0 && <b className="sf-cart-count">{n}</b>}
    </Link>
  );
}
