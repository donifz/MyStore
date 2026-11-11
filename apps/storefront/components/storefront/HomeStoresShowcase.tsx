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

export default function HomeStoresShowcase({ stores }: { stores: Store[] }) {
  if (!stores.length) return null;

  const statuses = stores.map((s) => getStoreOpenStatus(s));
  const openCount = statuses.filter((st) => st?.isOpen).length;

  return (
    <section className="sf-stores-strip sf-panel" aria-label="Магазины рядом">
      <div className="sf-section-heading sf-stores-showcase__head">
        <div className="sf-stores-showcase__title-group">
          <h2>Магазины рядом</h2>
          {openCount > 0 && (
            <span className="sf-stores-open-pill">Открыты сейчас</span>
          )}
        </div>
        <Link href="/shops" className="sf-stores-all-link">
          Все магазины <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="sf-stores-showcase__grid">
        {stores.map((s, index) => {
          const openStatus = statuses[index];
          const previews = (s.previewPhotos ?? []).slice(0, 3);
          const hasRating =
            Boolean(s.ratingCount) &&
            (s.ratingCount ?? 0) > 0 &&
            Boolean(s.ratingAverage);

          return (
            <Link
              href={'/shop/' + s.slug}
              key={s.slug}
              className="sf-home-store-card"
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
                  <span className="sf-home-store-card__verified">
                    <Icon name="check" width={10} height={10} />
                  </span>
                </span>
              </div>

              <div className="sf-home-store-card__body">
                <div className="sf-home-store-card__title-row">
                  <strong>{s.name}</strong>
                  {openStatus ? (
                    <span
                      className={`sf-home-store-status ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}
                    >
                      <span
                        className="sf-home-store-status__dot"
                        aria-hidden="true"
                      />
                      {openStatus.label}
                    </span>
                  ) : s.hours ? (
                    <span className="sf-home-store-status is-neutral">
                      {s.hours}
                    </span>
                  ) : null}
                </div>

                <p className="sf-home-store-card__meta">
                  <span>{s.city || 'Кыргызстан'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{pluralizeProducts(s.productCount ?? 0)}</span>
                  <span aria-hidden="true">·</span>
                  {hasRating ? (
                    <span className="sf-home-store-rating">
                      <span className="sf-star-glyph" aria-hidden="true">
                        ★
                      </span>{' '}
                      {s.ratingAverage!.toFixed(1).replace('.', ',')}
                    </span>
                  ) : (
                    <span>Новый</span>
                  )}
                </p>

                {previews.length > 0 ? (
                  <div className="sf-home-store-card__previews">
                    {previews.map((src, photoIndex) => (
                      <span
                        key={photoIndex}
                        className="sf-home-store-card__thumb"
                      >
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
                ) : (
                  <div className="sf-home-store-card__cats">
                    <span className="sf-home-store-card__cat-pill">
                      {s.description || 'Актуальное наличие и быстрая выдача'}
                    </span>
                  </div>
                )}

                <span className="sf-home-store-card__cta">
                  Открыть витрину <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
