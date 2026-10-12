import Link from 'next/link';
import type { Product } from '../../lib/public-api';
import Price from './Price';
import StockBadge from './StockBadge';
export default function ProductCard({ product: p }: { product: Product }) {
  return (
    <Link
      className="sf-product-card"
      href={`/shops/${p.store.slug}/products/${p.id}`}
    >
      <div className="sf-product-cover" aria-hidden="true">
        {p.photoUrl ? (
          <img src={p.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="sf-product-placeholder">
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="sf-product-category">
          {p.category || 'Товар магазина'}
        </span>
      </div>
      <div className="sf-product-copy">
        <p className="sf-product-store">
          {p.store.name} · {p.store.city}
        </p>
        <h3>{p.name}</h3>
        <Price minor={p.salePriceMinor} />
        <StockBadge available={p.available} />
      </div>
    </Link>
  );
}
