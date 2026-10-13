'use client';
import { useEffect, useState } from 'react';
import type { Product } from '../../lib/public-api';
import Icon from './Icon';
export const favoriteKey = 'mystore-favorites-v1';
export function readFavorites(): Product[] {
  try {
    const a = JSON.parse(localStorage.getItem(favoriteKey) || '[]');
    return Array.isArray(a)
      ? a
          .filter(
            (p) =>
              p &&
              typeof p.id === 'string' &&
              typeof p.name === 'string' &&
              typeof p.store?.slug === 'string',
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}
export default function FavoriteButton({ product }: { product: Product }) {
  const [selected, setSelected] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const sync = () =>
      setSelected(readFavorites().some((p) => p.id === product.id));
    sync();
    window.addEventListener('favorites-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('favorites-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [product.id]);
  return (
    <>
      <button
        type="button"
        className="sf-favorite"
        aria-pressed={selected}
        aria-label={
          (selected ? 'Удалить из избранного: ' : 'В избранное: ') +
          product.name
        }
        onClick={() => {
          try {
            const all = readFavorites();
            if (!selected && all.length >= 100)
              throw Error('В избранном можно сохранить до 100 товаров.');
            localStorage.setItem(
              favoriteKey,
              JSON.stringify(
                selected
                  ? all.filter((p) => p.id !== product.id)
                  : [...all, product],
              ),
            );
            window.dispatchEvent(new Event('favorites-change'));
            setError('');
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : 'Не удалось сохранить избранное.',
            );
          }
        }}
      >
        <Icon name="heart" fill={selected ? 'currentColor' : 'none'} />
      </button>
      {error && <small role="alert">{error}</small>}
    </>
  );
}
