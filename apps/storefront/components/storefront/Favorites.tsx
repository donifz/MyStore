'use client';
import { useEffect, useState } from 'react';
import { readFavorites } from './FavoriteButton';
import ProductCard from './ProductCard';
import type { Product } from '../../lib/public-api';
import { EmptyState, LinkButton, Alert } from '../ui';
export default function Favorites() {
  const [items, setItems] = useState<Product[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
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
      <h1>Избранное</h1>
      <p className="sf-muted">Ваши находки сохранены в этом браузере.</p>
      {error && <Alert variant="error">{error}</Alert>}
      {!ready ? (
        <p role="status">Загружаем товары…</p>
      ) : items.length ? (
        <div className="sf-related-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
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
