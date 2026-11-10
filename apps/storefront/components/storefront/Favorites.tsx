'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { favoriteKey, readFavorites } from './FavoriteButton';
import ProductCard from './ProductCard';
import type { Product } from '../../lib/public-api';
import { EmptyState, LinkButton, Alert } from '../ui';
import Icon from './Icon';

const DEMO_STORE = {
  slug: 'mir-igrushek',
  name: 'Мир игрушек',
  description: 'Магазин развивающих игрушек',
  city: 'Ош',
};

const DEMO_FAVORITES: Product[] = [
  {
    id: '11111111-1111-4111-8111-111111111100',
    name: 'Плюшевый мишка',
    description: 'Мягкая игрушка, 30 см',
    category: 'Мягкие игрушки',
    salePriceMinor: 129000,
    available: 15,
    store: DEMO_STORE,
  },
  {
    id: '11111111-1111-4111-8111-111111111107',
    name: 'Машинка на управлении',
    description: 'Радиоуправляемая, масштаб 1:16',
    category: 'Машинки',
    salePriceMinor: 199000,
    available: 9,
    store: DEMO_STORE,
  },
  {
    id: '11111111-1111-4111-8111-111111111108',
    name: 'Конструктор (300 деталей)',
    description: 'Развивающий набор, 6+',
    category: 'Конструкторы',
    salePriceMinor: 249000,
    available: 11,
    store: DEMO_STORE,
  },
  {
    id: '11111111-1111-4111-8111-111111111109',
    name: 'Робот интерактивный',
    description: 'Свет, звук и голосовые команды',
    category: 'Развивающие',
    salePriceMinor: 399000,
    available: 7,
    store: DEMO_STORE,
  },
];

export default function Favorites() {
  const [items, setItems] = useState<Product[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    if (
      typeof window !== 'undefined' &&
      window.location.port === '3001' &&
      !localStorage.getItem(favoriteKey)
    ) {
      localStorage.setItem(favoriteKey, JSON.stringify(DEMO_FAVORITES));
    }
    async function sync() {
      const saved = readFavorites();
      const results = await Promise.allSettled(
        saved.map(async (p) => {
          const r = await fetch(
            `/api/public/stores/${encodeURIComponent(p.store.slug)}/products/${encodeURIComponent(p.id)}`,
          );
          if (r.status === 404) return null;
          if (!r.ok) throw Error();
          return (await r.json()) as Product;
        }),
      );
      if (!live) return;
      setItems(
        results.flatMap((r) =>
          r.status === 'fulfilled' && r.value ? [r.value] : [],
        ),
      );
      setError(
        results.some((r) => r.status === 'rejected')
          ? 'Часть товаров не удалось загрузить. Обновите страницу.'
          : '',
      );
      setReady(true);
    }
    void sync();
    window.addEventListener('favorites-change', sync);
    return () => {
      live = false;
      window.removeEventListener('favorites-change', sync);
    };
  }, []);

  return (
    <div className="sf-stack">
      <nav className="sf-breadcrumbs" aria-label="Навигация">
        <Link href="/">Главная</Link>
        <span>›</span>
        <span>Избранное</span>
      </nav>
      <div className="sf-cart-page-header">
        <div className="sf-cart-title-group">
          <span
            className="sf-cart-title-icon sf-fav-title-icon"
            aria-hidden="true"
          >
            <Icon name="heart" fill="currentColor" />
          </span>
          <h1>
            Избранное {ready && items.length > 0 ? `(${items.length})` : ''}
          </h1>
        </div>
        <LinkButton variant="secondary" href="/catalog">
          В каталог
        </LinkButton>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {!ready ? (
        <p role="status">Загружаем товары…</p>
      ) : items.length ? (
        <div className="sf-related-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} storeView />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Сохраните то, что нравится"
          description="Нажимайте на сердечко в карточке товара, чтобы вернуться к нему позже."
          action={<LinkButton href="/">Найти товары</LinkButton>}
        />
      )}
    </div>
  );
}
