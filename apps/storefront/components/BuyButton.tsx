'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Alert } from './ui';
import type { Product } from '../lib/public-api';
import { useCart } from './CartProvider';
import Icon from './storefront/Icon';
import { buildProductWhatsAppUrl } from '../lib/whatsapp';

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
    [quantity, setQuantity] = useState(1),
    [localError, setLocalError] = useState('');

  const whatsAppUrl = buildProductWhatsAppUrl({
    phone: product.store.phone,
    productName: product.name,
    priceMinor: product.salePriceMinor,
    storeName: product.store.name,
    pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  const cartItem = c.ready
    ? c.items.find(
        (item) =>
          item.id === product.id && item.storeSlug === product.store.slug,
      )
    : undefined;
  const inCartQty = cartItem?.quantity ?? 0;
  const inCart = inCartQty > 0;
  const pending = Boolean(
    c.checkoutKey || c.state.attempts[product.store.slug],
  );

  if (pending) {
    return (
      <div
        className={
          compact ? 'sf-buy-actions sf-buy-actions--compact' : 'sf-buy-actions'
        }
      >
        <Link className="sf-button sf-button--secondary" href="/cart">
          Проверить заказ
        </Link>
      </div>
    );
  }

  function add(now = false) {
    setLocalError('');
    if (inCartQty + quantity > product.available) {
      setLocalError('Выбрано больше, чем есть в наличии.');
      return;
    }
    if (c.add(product, false, quantity)) {
      setAdded(true);
      if (now) router.push('/checkout');
    } else if (!compact && c.error) {
      setLocalError(c.error);
    }
  }

  if (compact) {
    const compactBtnClass = iconOnly
      ? 'sf-icon-cart-btn'
      : 'sf-full sf-icon-cart-btn';
    return (
      <div className="sf-buy-actions sf-buy-actions--compact">
        <div className="sf-buy-compact-wrap">
          {inCart ? (
            <Link
              href="/cart"
              className={`sf-button ${compactBtnClass} sf-icon-cart-btn--in-cart`}
              aria-label="В корзине, перейти в корзину"
              title="В корзине · перейти"
            >
              <Icon name="cart" width={18} height={18} />
            </Link>
          ) : (
            <Button
              variant="secondary"
              className={compactBtnClass}
              aria-label={
                product.available < 1 ? 'Товар закончился' : 'В корзину'
              }
              title={product.available < 1 ? 'Товар закончился' : 'В корзину'}
              disabled={!c.ready || product.available < 1}
              onClick={() => add()}
            >
              <Icon name="cart" width={18} height={18} />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="sf-buy-actions">
      <div className="sf-buy-primary-row">
        {product.available > 0 && (
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
      <Button
        className="sf-full sf-buy-now-btn"
        variant="secondary"
        disabled={!c.ready || product.available < 1}
        onClick={() => add(true)}
      >
        <Icon name="bolt" width={18} height={18} />
        Купить сейчас
      </Button>
      {whatsAppUrl && product.available > 0 && (
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="sf-whatsapp-btn"
          aria-label="Заказать в WhatsApp"
        >
          <Icon name="whatsapp" width={18} height={18} />
          Заказать в WhatsApp
        </a>
      )}
      {(added || inCart) && (
        <div role="status">
          <Link className="sf-added" href="/cart">
            Добавлено · Перейти в корзину
          </Link>
        </div>
      )}
      {localError && <Alert variant="error">{localError}</Alert>}
    </div>
  );
}
