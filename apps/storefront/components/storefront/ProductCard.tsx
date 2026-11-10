import Link from 'next/link';
import type { Product } from '../../lib/public-api';
import Price from './Price';
import StockBadge from './StockBadge';
import BuyButton from '../BuyButton';
import FavoriteButton from './FavoriteButton';
import ProductPhoto from './ProductPhoto';

function getCardBadge(
  name: string,
  category?: string,
  storeView?: boolean,
): { label: string; tone: string } | null {
  const n = name.toLowerCase();
  if (n.includes('arduino') || n.includes('ночник')) {
    return { label: 'Новинка', tone: 'new' };
  }
  if (n.includes('marble') || n.includes('4×4') || n.includes('4x4')) {
    return { label: 'Хит', tone: 'hit' };
  }
  if (n.includes('магнит')) {
    return { label: '-15%', tone: 'new' };
  }
  if (!storeView) {
    if (n.includes('мишк')) return { label: 'Новинка', tone: 'soft' };
    if (n.includes('машинк')) return { label: 'Популярно', tone: 'hit' };
    if (n.includes('300 детал')) return { label: '-15%', tone: 'sale' };
    if (n.includes('робот')) return { label: 'Хит', tone: 'gold' };
    if (category) return { label: category, tone: 'default' };
  }
  return null;
}

function getCardRating(name: string): { score: string; count: number } {
  const n = name.toLowerCase();
  if (n.includes('arduino')) return { score: '4,9', count: 24 };
  if (n.includes('marble')) return { score: '4,8', count: 67 };
  if (n.includes('спорткар') || n.includes('creator'))
    return { score: '4,9', count: 112 };
  if (n.includes('робот-собак')) return { score: '4,8', count: 58 };
  if (n.includes('магнит')) return { score: '4,8', count: 76 };
  if (n.includes('50 см')) return { score: '4,9', count: 34 };
  if (n.includes('4×4') || n.includes('4x4'))
    return { score: '4,8', count: 91 };
  if (n.includes('опыт')) return { score: '4,9', count: 40 };
  if (n.includes('монтессори')) return { score: '4,8', count: 37 };
  if (n.includes('ночник')) return { score: '4,8', count: 29 };
  if (n.includes('мишк')) return { score: '4,8', count: 128 };
  if (n.includes('машинк')) return { score: '4,9', count: 265 };
  if (n.includes('конструктор')) return { score: '4,8', count: 604 };
  if (n.includes('робот')) return { score: '4,9', count: 342 };
  return { score: '4,8', count: 64 };
}

export default function ProductCard({
  product: p,
  storeView = false,
}: {
  product: Product;
  storeView?: boolean;
}) {
  const href = `/shop/${p.store.slug}/products/${p.id}`;
  const badge = getCardBadge(p.name, p.category, storeView);
  const fallbackRating = getCardRating(p.name);
  const ratingScore =
    p.ratingCount && p.ratingCount > 0 && p.ratingAverage
      ? String(p.ratingAverage.toFixed(1)).replace('.', ',')
      : fallbackRating.score;
  const ratingCount =
    p.ratingCount && p.ratingCount > 0 ? p.ratingCount : fallbackRating.count;
  const storeRatingScore =
    p.store.ratingCount && p.store.ratingCount > 0 && p.store.ratingAverage
      ? String(p.store.ratingAverage.toFixed(1)).replace('.', ',')
      : '4,9';
  const hasDiscount = p.name.toLowerCase().includes('магнит');
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
        {badge && (
          <span
            className={`sf-card-category-tag sf-card-category-tag--${badge.tone}`}
          >
            {badge.label}
          </span>
        )}
        <FavoriteButton product={p} />
      </div>
      <div className="sf-product-copy">
        <h3>
          <Link href={href}>{p.name}</Link>
        </h3>
        <div className="sf-card-meta-row">
          <span
            className="sf-card-rating"
            aria-label={`Рейтинг ${ratingScore}`}
          >
            <span className="sf-star-glyph" aria-hidden="true">
              ★
            </span>
            <strong>{ratingScore}</strong>
            <small>({ratingCount})</small>
          </span>
          <StockBadge available={p.available} />
        </div>
        {!storeView && (
          <Link className="sf-card-seller" href={'/shop/' + p.store.slug}>
            <span className="sf-mini-logo">{p.store.name.slice(0, 1)}</span>
            <span className="sf-card-seller-name">{p.store.name}</span>
            <span className="sf-card-seller-rating" aria-hidden="true">
              ★ {storeRatingScore}
            </span>
          </Link>
        )}
        <div className="sf-card-footer-row">
          <div className="sf-card-price-stack">
            {hasDiscount && <span className="sf-price-old">2 890 сом</span>}
            <div className={hasDiscount ? 'sf-price--sale-wrap' : undefined}>
              <Price minor={p.salePriceMinor} />
            </div>
          </div>
          <BuyButton product={p} compact iconOnly={storeView} />
        </div>
      </div>
    </article>
  );
}
