'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Alert } from './ui';
import type { Product } from '../lib/public-api';
import { useCart } from './CartProvider';
import Icon from './storefront/Icon';
export default function BuyButton({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const c = useCart(),
    router = useRouter(),
    [added, setAdded] = useState(false),
    [quantity, setQuantity] = useState(1);
  const pending = Boolean(
    c.checkoutKey || c.state.attempts[product.store.slug],
  );
  if (pending)
    return (
      <Link className="sf-button sf-button--secondary" href="/cart">
        Проверить заказ
      </Link>
    );
  function add(now = false) {
    if (c.add(product, false, quantity)) {
      setAdded(true);
      if (now) router.push('/cart#checkout');
    }
  }
  return (
    <div className="sf-buy-actions">
      {!compact && product.available > 0 && (
        <div className="sf-quantity-row">
          <div className="sf-quantity">
            <button
              type="button"
              aria-label="Уменьшить количество"
              disabled={quantity <= 1}
              onClick={() => setQuantity((n) => n - 1)}
            >
              −
            </button>
            <input
              aria-label="Количество товара"
              type="number"
              min="1"
              max={product.available}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(
                    1,
                    Math.min(product.available, Number(e.target.value) || 1),
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label="Увеличить количество"
              disabled={quantity >= product.available}
              onClick={() => setQuantity((n) => n + 1)}
            >
              +
            </button>
          </div>
          <small>Доступно {product.available} шт.</small>
        </div>
      )}
      <Button
        className="sf-full"
        disabled={!c.ready || product.available < 1}
        onClick={() => add()}
      >
        <Icon name="cart" />
        {product.available < 1
          ? 'Нет в наличии'
          : added
            ? 'Добавить ещё'
            : 'В корзину'}
      </Button>
      {!compact && (
        <Button
          className="sf-full"
          variant="secondary"
          disabled={!c.ready || product.available < 1}
          onClick={() => add(true)}
        >
          Купить сейчас <Icon name="arrow" />
        </Button>
      )}
      {added && (
        <div role="status">
          <Link className="sf-added" href="/cart">
            Добавлено · Перейти в корзину
          </Link>
        </div>
      )}
      {c.error && <Alert variant="error">{c.error}</Alert>}
    </div>
  );
}
