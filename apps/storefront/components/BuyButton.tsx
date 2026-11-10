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
  iconOnly = false,
}: {
  product: Product;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const c = useCart(),
    router = useRouter(),
    [added, setAdded] = useState(false),
    [quantity, setQuantity] = useState(1);
  const inCart =
    c.ready &&
    c.items.some(
      (item) => item.id === product.id && item.storeSlug === product.store.slug,
    );
  const pending = Boolean(
    c.checkoutKey || c.state.attempts[product.store.slug],
  );
  if (pending)
    return (
      <div
        className={
          compact ? 'sf-buy-actions sf-buy-actions--compact' : 'sf-buy-actions'
        }
      >
        <Link className="sf-button sf-button--secondary" href="/cart">
          Проверить заказ
        </Link>
        {compact && <div className="sf-card-buy-status" />}
      </div>
    );
  function add(now = false) {
    if (c.add(product, false, quantity)) {
      setAdded(true);
      if (now) router.push('/checkout');
    }
  }
  return (
    <div
      className={
        compact ? 'sf-buy-actions sf-buy-actions--compact' : 'sf-buy-actions'
      }
    >
      <div className={compact ? 'sf-buy-compact-wrap' : 'sf-buy-primary-row'}>
        {!compact && product.available > 0 && (
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
        )}
        <Button
          className={iconOnly ? 'sf-icon-cart-btn' : 'sf-full'}
          aria-label={iconOnly ? 'В корзину' : undefined}
          disabled={!c.ready || product.available < 1}
          onClick={() => add()}
        >
          <Icon name="cart" width={18} height={18} />
          {!iconOnly &&
            (product.available < 1
              ? 'Нет в наличии'
              : added
                ? 'Добавить ещё'
                : 'В корзину')}
        </Button>
      </div>
      {!compact && (
        <Button
          className="sf-full sf-buy-now-btn"
          variant="secondary"
          disabled={!c.ready || product.available < 1}
          onClick={() => add(true)}
        >
          <Icon name="bolt" width={18} height={18} />
          Купить сейчас
        </Button>
      )}
      {(compact || added || inCart) && (
        <div
          role="status"
          className={compact ? 'sf-card-buy-status' : undefined}
        >
          {(added || inCart) && (
            <Link className="sf-added" href="/cart">
              Добавлено · Перейти в корзину
            </Link>
          )}
        </div>
      )}
      {c.error && <Alert variant="error">{c.error}</Alert>}
    </div>
  );
}
