'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Product } from '../lib/public-api';
import { useCart } from './CartProvider';
export default function BuyButton({ product }: { product: Product }) {
  const c = useCart(),
    [replace, setReplace] = useState(false),
    [added, setAdded] = useState(false);
  if (c.checkoutKey)
    return (
      <p>
        У вас есть оформляемый заказ. <Link href="/cart">Проверить заказ</Link>
      </p>
    );
  return (
    <div className="buy-actions">
      <button
        className="primary"
        disabled={!c.ready || !product.available}
        onClick={() => {
          if (c.items.length && c.items[0].storeSlug !== product.store.slug) {
            setReplace(true);
            return;
          }
          setAdded(c.add(product));
        }}
      >
        {product.available ? 'В корзину' : 'Нет в наличии'}
      </button>
      {added && (
        <p role="status">
          Товар в корзине. <Link href="/cart">Оформить заказ</Link>
        </p>
      )}
      {replace && (
        <div role="alert">
          <p>
            Заказ оформляется у одного магазина. Заменить корзину магазина «
            {c.items[0]?.storeName}»?
          </p>
          <button
            onClick={() => {
              setAdded(c.add(product, true));
              setReplace(false);
            }}
          >
            Заменить корзину
          </button>
          <button onClick={() => setReplace(false)}>Оставить корзину</button>
        </div>
      )}
      {c.error && <p role="alert">{c.error}</p>}
      <noscript>
        Для оформления заказа включите JavaScript или свяжитесь с магазином.
      </noscript>
    </div>
  );
}
