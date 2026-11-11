import Link from 'next/link';
import type { Product } from '../../lib/public-api';
import Price from './Price';
import StockBadge from './StockBadge';
import BuyButton from '../BuyButton';
import FavoriteButton from './FavoriteButton';
import ProductPhoto from './ProductPhoto';

export default function ProductCard({
  product: p,
  storeView = false,
}: {
  product: Product;
  storeView?: boolean;
}) {
  const href = `/shop/${p.store.slug}/products/${p.id}`;
  const hasRating = Boolean(
    p.ratingCount && p.ratingCount > 0 && p.ratingAverage,
  );
  const ratingScore = hasRating
    ? String(p.ratingAverage!.toFixed(1)).replace('.', ',')
    : null;
  const storeRatingScore =
    p.store.ratingCount && p.store.ratingCount > 0 && p.store.ratingAverage
      ? String(p.store.ratingAverage.toFixed(1)).replace('.', ',')
      : null;

  return (
    <article
      className={
        storeView ? 'sf-product-card sf-product-card--store' : 'sf-product-card'
      }
    >
      <div className="sf-card-media">
        <Link href={href} aria-label={p.name}>
          <div className="sf-product-cover">
            <ProductPhoto src={p.photoUrl} alt={p.name} category={p.category} />
          </div>
        </Link>
        {!storeView && p.category && (
          <span className="sf-card-category-tag sf-card-category-tag--default">
            {p.category}
          </span>
        )}
        <FavoriteButton product={p} />
      </div>
      <div className="sf-product-copy">
        <h3>
          <Link href={href}>{p.name}</Link>
        </h3>
        <div className="sf-card-meta-row">
          {hasRating && (
            <span
              className="sf-card-rating"
              aria-label={`Рейтинг ${ratingScore}`}
            >
              <span className="sf-star-glyph" aria-hidden="true">
                ★
              </span>
              <strong>{ratingScore}</strong>
              <small>({p.ratingCount})</small>
            </span>
          )}
          <StockBadge available={p.available} />
        </div>
        {!storeView && (
          <Link className="sf-card-seller" href={'/shop/' + p.store.slug}>
            <span className="sf-mini-logo">{p.store.name.slice(0, 1)}</span>
            <span className="sf-card-seller-name">{p.store.name}</span>
            {storeRatingScore && (
              <span className="sf-card-seller-rating" aria-hidden="true">
                ★ {storeRatingScore}
              </span>
            )}
          </Link>
        )}
        <div className="sf-card-footer-row">
          <div className="sf-card-price-stack">
            <Price minor={p.salePriceMinor} />
          </div>
          <BuyButton product={p} compact iconOnly={storeView} />
        </div>
      </div>
    </article>
  );
}
