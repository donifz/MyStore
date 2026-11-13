import Link from 'next/link';
import { pluralizeProducts, type Store } from '../../lib/public-api';
import { getStoreOpenStatus } from '../../lib/store-hours';
import Icon, { CategoryIllustration } from './Icon';

function avatarCategory(store: Store): string {
  const n = store.name.toLowerCase();
  if (n.includes('игруш')) return 'Мягкие игрушки';
  if (n.includes('инженер') || n.includes('робот') || n.includes('тех'))
    return 'Электроника';
  if (n.includes('coffee') || n.includes('кофе')) return 'Кофе и чай';
  if (n.includes('пекарн') || n.includes('тесто')) return 'Выпечка';
  if (n.includes('цвет')) return 'Цветы';
  return store.categories?.[0] || 'Все';
}

export default function StoreCard({
  store: s,
  index = 0,
}: {
  store: Store;
  index?: number;
}) {
  const openStatus = getStoreOpenStatus(s);
  const previews = (s.previewPhotos ?? []).slice(0, 3);
  const hasRating =
    Boolean(s.ratingCount) &&
    (s.ratingCount ?? 0) > 0 &&
    Boolean(s.ratingAverage);
  const ratingLabel = hasRating
    ? s.ratingAverage!.toFixed(1).replace('.', ',')
    : null;

  return (
    <article className="sf-store-card sf-store-card--modern">
      <Link
        href={'/shop/' + s.slug}
        className="sf-home-store-card sf-store-card-link"
        aria-label={s.name}
      >
        <div
          className={`sf-home-store-card__cover sf-home-store-card__cover--${index % 3}${s.banner?.imageDataUrl ? ' sf-home-store-card__cover--has-banner' : ''}`}
        >
          {s.banner?.imageDataUrl ? (
            <img
              src={s.banner.imageDataUrl}
              alt={`Баннер магазина ${s.name}`}
              className="sf-home-store-card__cover-img"
            />
          ) : (
            <div
              className="sf-home-store-card__cover-pattern"
              aria-hidden="true"
            />
          )}

          <span className="sf-home-store-card__avatar" aria-hidden="true">
            <CategoryIllustration category={avatarCategory(s)} />
            <span
              className="sf-home-store-card__verified"
              title="Проверенный продавец MyStore"
            >
              <Icon name="check" width={10} height={10} />
            </span>
          </span>

          {openStatus ? (
            <span
              className={`sf-home-store-status sf-store-card__status-badge ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}
            >
              <span className="sf-home-store-status__dot" aria-hidden="true" />
              {openStatus.label}
            </span>
          ) : s.hours ? (
            <span className="sf-home-store-status is-neutral sf-store-card__status-badge">
              {s.hours}
            </span>
          ) : null}
        </div>

        <div className="sf-home-store-card__body sf-store-card__body">
          <div className="sf-home-store-card__title-row sf-store-card__title-row">
            <h2>{s.name}</h2>
          </div>

          <p className="sf-home-store-card__meta">
            <span>
              {s.city || 'Кыргызстан'}
              {s.district ? `, ${s.district}` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>{pluralizeProducts(s.productCount ?? 0)}</span>
            <span aria-hidden="true">·</span>
            {hasRating ? (
              <span className="sf-home-store-rating">
                <span className="sf-star-glyph" aria-hidden="true">
                  ★
                </span>{' '}
                {ratingLabel}
                {s.ratingCount ? (
                  <span className="sf-rating-count-pill">
                    ({s.ratingCount})
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="sf-store-new-badge">Новый</span>
            )}
          </p>

          {s.description ? (
            <p className="sf-store-card-desc">{s.description}</p>
          ) : null}

          {previews.length > 0 ? (
            <div className="sf-home-store-card__previews">
              {previews.map((src, photoIndex) => (
                <span key={photoIndex} className="sf-home-store-card__thumb">
                  <img src={src} alt="" loading="lazy" />
                </span>
              ))}
            </div>
          ) : s.categories && s.categories.length > 0 ? (
            <div className="sf-home-store-card__cats">
              {s.categories.slice(0, 3).map((cat) => (
                <span key={cat} className="sf-home-store-card__cat-pill">
                  {cat}
                </span>
              ))}
            </div>
          ) : null}

          <div className="sf-store-card-features">
            {s.pickupEnabled !== false && (
              <span className="sf-store-feature-pill">
                <Icon name="shop" width={12} height={12} />
                <span>Самовывоз</span>
              </span>
            )}
            {s.deliveryEnabled && (
              <span className="sf-store-feature-pill sf-store-feature-pill--delivery">
                <Icon name="truck" width={12} height={12} />
                <span>Доставка</span>
              </span>
            )}
            {s.phone && (
              <span className="sf-store-feature-pill sf-store-feature-pill--phone">
                <Icon name="phone" width={12} height={12} />
                <span>Связь</span>
              </span>
            )}
          </div>

          <span className="sf-home-store-card__cta">
            Перейти в магазин <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
