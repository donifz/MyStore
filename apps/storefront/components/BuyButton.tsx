'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Alert } from './ui';
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
    <div className="sf-stack">
      <Button
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
      </Button>
      {added && (
        <Alert variant="success">
          Товар в корзине. <Link href="/cart">Оформить заказ</Link>
        </Alert>
      )}
      {replace && (
        <Alert variant="info">
          <p>
            Заказ оформляется у одного магазина. Заменить корзину магазина «
            {c.items[0]?.storeName}»?
          </p>
          <Button
            onClick={() => {
              setAdded(c.add(product, true));
              setReplace(false);
            }}
          >
            Заменить корзину
          </Button>
          <Button onClick={() => setReplace(false)}>Оставить корзину</Button>
        </Alert>
      )}
      {c.error && <Alert variant="error">{c.error}</Alert>}
      <noscript>
        Для оформления заказа включите JavaScript или свяжитесь с магазином.
      </noscript>
    </div>
  );
}
