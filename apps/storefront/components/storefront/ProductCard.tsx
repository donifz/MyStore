import Link from 'next/link';
import type { Product } from '../../lib/public-api';
import Price from './Price';
import StockBadge from './StockBadge';
import BuyButton from '../BuyButton';
import FavoriteButton from './FavoriteButton';
import Icon from './Icon';
export default function ProductCard({ product: p }: { product: Product }) {
  const href = `/shops/${p.store.slug}/products/${p.id}`;
  return (
    <article className="sf-product-card">
      <div className="sf-card-media">
        <Link href={href} aria-label={p.name}>
          <div className="sf-product-cover">
            {p.photoUrl ? (
              <img src={p.photoUrl} alt={p.name} loading="lazy" />
            ) : (
              <span className="sf-product-placeholder">
                <Icon name="box" width={52} height={52} />
              </span>
            )}
          </div>
        </Link>
        <FavoriteButton product={p} />
        <StockBadge available={p.available} />
      </div>
      <div className="sf-product-copy">
        <small className="sf-muted">{p.category || 'Товар магазина'}</small>
        <h3>
          <Link href={href}>{p.name}</Link>
        </h3>
        <Price minor={p.salePriceMinor} />
        <Link className="sf-card-seller" href={'/shops/' + p.store.slug}>
          <span className="sf-mini-logo">{p.store.name.slice(0, 1)}</span>
          {p.store.name}
        </Link>
        <BuyButton product={p} compact />
      </div>
    </article>
  );
}
