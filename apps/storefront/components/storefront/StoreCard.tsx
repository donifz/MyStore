import Link from 'next/link';
import type { Store } from '../../lib/public-api';
export default function StoreCard({ store: s }: { store: Store }) {
  return (
    <Link className="sf-store-card" href={'/shops/' + s.slug}>
      <span className="sf-store-monogram" aria-hidden="true">
        {s.name.slice(0, 1).toUpperCase()}
      </span>
      <p className="sf-eyebrow">{s.city}</p>
      <h2>{s.name}</h2>
      <p className="sf-muted">{s.description || 'Откройте каталог магазина'}</p>
      <span className="sf-store-card__action">
        Перейти в магазин <span aria-hidden="true">↗</span>
      </span>
    </Link>
  );
}
