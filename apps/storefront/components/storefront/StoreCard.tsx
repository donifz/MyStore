import Link from 'next/link';
import type { Store } from '../../lib/public-api';
import Icon, { CategoryIllustration } from './Icon';

function getStoreVisual(s: Store): {
  rating: string;
  countLabel: string;
  bg: string;
  categoryKey: string;
} {
  const n = s.name.toLowerCase();
  if (n.includes('игруш')) {
    return {
      rating: '4,9',
      countLabel: '1 240 товаров',
      bg: '#fff7ed',
      categoryKey: 'Мягкие игрушки',
    };
  }
  if (n.includes('coffee') || n.includes('кофе')) {
    return {
      rating: '4,9',
      countLabel: '340 товаров',
      bg: '#eff6ff',
      categoryKey: 'Кофе и чай',
    };
  }
  if (n.includes('пекарн') || n.includes('тесто')) {
    return {
      rating: '4,8',
      countLabel: '180 товаров',
      bg: '#fffbeb',
      categoryKey: 'Выпечка',
    };
  }
  if (n.includes('цвет')) {
    return {
      rating: '4,9',
      countLabel: '420 товаров',
      bg: '#fdf2f8',
      categoryKey: 'Цветы',
    };
  }
  return {
    rating: '4,8',
    countLabel: `${s.productCount ?? 120} товаров`,
    bg: '#eef5ff',
    categoryKey: s.categories?.[0] || 'Все',
  };
}

export default function StoreCard({ store: s }: { store: Store }) {
  const visual = getStoreVisual(s);
  const ratingLabel =
    s.ratingCount && s.ratingCount > 0 && s.ratingAverage
      ? String(s.ratingAverage.toFixed(1)).replace('.', ',')
      : visual.rating;
  const reviewsText =
    s.ratingCount && s.ratingCount > 0 ? `${s.ratingCount} отзывов` : null;
  return (
    <article className="sf-store-card sf-store-card--modern">
      <Link
        href={'/shop/' + s.slug}
        className="sf-store-card-row"
        aria-label={s.name}
      >
        <span
          className="sf-store-card-avatar"
          style={{ background: visual.bg }}
          aria-hidden="true"
        >
          <CategoryIllustration category={visual.categoryKey} />
        </span>

        <div className="sf-store-card-info">
          <div className="sf-store-card-title">
            <h2>{s.name}</h2>
            <span className="sf-verified-badge" aria-hidden="true">
              <Icon name="check" width={12} height={12} />
            </span>
          </div>

          <p className="sf-store-card-sub">
            {s.description || 'Товары и быстрая выдача в магазине'}
          </p>

          <div className="sf-store-card-stats">
            <span className="sf-star-glyph" aria-hidden="true">
              ★
            </span>
            <strong>{ratingLabel}</strong>
            {reviewsText && (
              <>
                <span>•</span>
                <span>{reviewsText}</span>
              </>
            )}
            <span>•</span>
            <span>{visual.countLabel}</span>
            {s.city && (
              <>
                <span>•</span>
                <span>{s.city}</span>
              </>
            )}
          </div>
        </div>

        <span className="sf-store-card-chevron" aria-hidden="true">
          <Icon name="chevronRight" width={20} height={20} />
        </span>
      </Link>
    </article>
  );
}
