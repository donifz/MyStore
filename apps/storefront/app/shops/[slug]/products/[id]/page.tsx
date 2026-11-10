import ProductGallery from '../../../../../components/storefront/ProductGallery';
import ProductCard from '../../../../../components/storefront/ProductCard';
import ProductPhoto from '../../../../../components/storefront/ProductPhoto';
import FavoriteButton from '../../../../../components/storefront/FavoriteButton';
import Icon, {
  CategoryIllustration,
} from '../../../../../components/storefront/Icon';
import { Alert } from '../../../../../components/ui';
import Price from '../../../../../components/storefront/Price';
import StockBadge from '../../../../../components/storefront/StockBadge';
import BuyButton from '../../../../../components/BuyButton';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, permanentRedirect } from 'next/navigation';
import {
  publicApi,
  PublicApiError,
  Product,
  Products,
  formatSom,
} from '../../../../../lib/public-api';
import { metadata, productJson } from '../../../../../lib/seo';
import Refresh from '../../../../../components/Refresh';
import VariantSelector from '../../../../../components/storefront/VariantSelector';
import ReviewsWidget from '../../../../../components/storefront/ReviewsWidget';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string; id: string }> };
async function load(params: Props['params']) {
  const { slug, id } = await params;
  return publicApi<Product>(
    '/stores/' +
      encodeURIComponent(slug) +
      '/products/' +
      encodeURIComponent(id),
  );
}
export async function generateMetadata({ params }: Props) {
  try {
    const p = await load(params);
    return metadata(
      p.name + ' — ' + p.store.name + ' | MyStore',
      p.description ||
        `${p.name}: цена ${formatSom(p.salePriceMinor)}, магазин ${p.store.name}, ${p.store.city}.`,
      `/shop/${p.store.slug}/products/${p.id}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    return metadata(
      'Товар временно недоступен — MyStore',
      'Попробуйте позднее.',
      '/',
      true,
    );
  }
}
export default async function ProductPage({ params }: Props) {
  const requested = await params;
  let v: Product;
  try {
    v = await load(params);
  } catch (e) {
    if (e instanceof PublicApiError && (e.status === 404 || e.status === 400))
      notFound();
    return (
      <Alert variant="error">
        <h1>Не удалось загрузить товар</h1>
        <p>Попробуйте позднее.</p>
      </Alert>
    );
  }
  if (v.store.slug !== requested.slug)
    permanentRedirect(`/shop/${v.store.slug}/products/${v.id}`);
  const phone = v.store.phone?.replace(/[^\d+]/g, '');
  let related: Product[] = [];
  try {
    related = (
      await publicApi<Products>(
        '/products?category=' + encodeURIComponent(v.category) + '&pageSize=5',
      )
    ).items
      .filter((p) => p.id !== v.id)
      .slice(0, 4);
  } catch {
    /* Product remains available. */
  }
  return (
    <div className="sf-stack">
      <Refresh />
      <script
        type="application/ld+json"
        nonce={(await headers()).get('x-nonce') || undefined}
        dangerouslySetInnerHTML={{ __html: productJson(v) }}
      />
      <div className="sf-product-store-bar sf-panel">
        <Link
          className="sf-product-store-identity"
          href={'/shop/' + v.store.slug}
        >
          <span className="sf-mini-logo sf-mini-logo--art">
            <CategoryIllustration category={v.category || v.store.name} />
          </span>
          <span>
            <strong>
              {v.store.name}
              <span className="sf-verified-badge" aria-hidden="true">
                <Icon name="check" width={12} height={12} />
              </span>
            </strong>
            <small>
              {v.store.description || `Магазин товаров · ${v.store.city}`}
            </small>
          </span>
        </Link>
        <nav
          className="sf-product-store-nav"
          aria-label="Навигация по магазину"
        >
          <Link href={'/shop/' + v.store.slug}>Главная</Link>
          <Link href={'/shop/' + v.store.slug + '#catalog'}>Товары</Link>
          <Link
            href={
              '/shop/' +
              v.store.slug +
              (v.category
                ? '?category=' + encodeURIComponent(v.category)
                : '') +
              '#catalog'
            }
          >
            Категории
          </Link>
          <Link href={'/shop/' + v.store.slug + '#store-about'}>
            О магазине
          </Link>
          <Link href="#product-reviews">Отзывы</Link>
        </nav>
        <Link
          className="sf-button sf-button--secondary sf-button--sm sf-subscribe-btn"
          href={'/shop/' + v.store.slug}
        >
          <Icon name="heart" width={16} height={16} />
          Подписаться
        </Link>
      </div>
      <nav className="sf-breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/" aria-label="Главная">
          <Icon name="home" width={14} height={14} />
        </Link>
        <span>/</span>
        <Link href="/shops">Магазины</Link>
        <span>/</span>
        <Link href={'/shop/' + v.store.slug}>{v.store.name}</Link>
        <span>/</span>
        {v.category && (
          <>
            <Link href={'/?category=' + encodeURIComponent(v.category)}>
              {v.category}
            </Link>
            <span>/</span>
          </>
        )}
        <span>{v.name}</span>
      </nav>
      <div className="sf-mobile-product-heading">
        <p className="sf-eyebrow">{v.category || 'Товар магазина'}</p>
        <div className="sf-detail-title">
          <h1>{v.name}</h1>
        </div>
      </div>
      <article className="sf-detail-layout">
        <ProductGallery
          photoUrl={v.photoUrl}
          photoUrls={v.photoUrls}
          name={v.name}
          category={v.category}
          product={v}
        />
        <aside className="sf-purchase-panel" aria-label="Покупка товара">
          <div className="sf-purchase-main">
            <div className="sf-detail-badges">
              <StockBadge available={v.available} detailed />
              {v.sku && <span className="sf-sku-pill">Арт. {v.sku}</span>}
            </div>
            <div className="sf-detail-title">
              <h1>{v.name}</h1>
            </div>
            <div className="sf-detail-rating-row">
              {v.ratingCount && v.ratingCount > 0 && v.ratingAverage ? (
                <a href="#product-reviews" className="sf-detail-rating">
                  <span className="sf-star-glyph" aria-hidden="true">
                    ★
                  </span>
                  <strong>
                    {v.ratingAverage.toFixed(1).replace('.', ',')}
                  </strong>
                  <small>
                    ({v.ratingCount}{' '}
                    {v.ratingCount === 1
                      ? 'отзыв'
                      : v.ratingCount < 5
                        ? 'отзыва'
                        : 'отзывов'}
                    )
                  </small>
                </a>
              ) : (
                <a
                  href="#product-reviews"
                  className="sf-detail-rating sf-detail-rating--new"
                >
                  <span className="sf-star-glyph" aria-hidden="true">
                    ★
                  </span>
                  <span>Пока нет отзывов</span>
                  <small>Оставить отзыв</small>
                </a>
              )}
            </div>
            <Price minor={v.salePriceMinor} className="sf-detail-price" />
            <BuyButton product={v} />
            <VariantSelector
              currentId={v.id}
              storeSlug={v.store.slug}
              variants={v.variants}
            />
          </div>
          <div className="sf-purchase-side">
            <div className="sf-seller-card">
              <Link className="sf-seller-box" href={'/shop/' + v.store.slug}>
                <span className="sf-mini-logo sf-mini-logo--art">
                  <CategoryIllustration category={v.category || v.store.name} />
                </span>
                <span>
                  <strong>
                    {v.store.name}
                    <span className="sf-verified-badge" aria-hidden="true">
                      <Icon name="check" width={12} height={12} />
                    </span>
                  </strong>
                  <small>
                    {v.store.description || `Магазин · ${v.store.city}`}
                  </small>
                </span>
                <Icon name="chevronRight" width={18} height={18} />
              </Link>
              <div className="sf-seller-stats">
                <div>
                  <strong>
                    <span className="sf-star-glyph" aria-hidden="true">
                      ★
                    </span>{' '}
                    {v.store.ratingCount &&
                    v.store.ratingCount > 0 &&
                    v.store.ratingAverage
                      ? v.store.ratingAverage.toFixed(1).replace('.', ',')
                      : '5,0'}
                  </strong>
                  <small>
                    {v.store.ratingCount && v.store.ratingCount > 0
                      ? `${v.store.ratingCount} отзывов`
                      : 'Рейтинг магазина'}
                  </small>
                </div>
                <div>
                  <strong>{v.store.productCount ?? 1}</strong>
                  <small>товаров в магазине</small>
                </div>
              </div>
            </div>
            <div className="sf-fulfillment-card">
              <div className="sf-fulfillment">
                <span className="sf-fulfillment-icon">
                  <Icon name="box" width={18} height={18} />
                </span>
                <div>
                  <strong>В наличии</strong>
                  <small>
                    {v.available > 0 ? (
                      <>
                        Осталось{' '}
                        <span className="sf-stock-inline-pill">
                          {v.available} шт.
                        </span>
                      </>
                    ) : (
                      'Нет на складе'
                    )}
                  </small>
                </div>
              </div>
              <div className="sf-fulfillment">
                <span className="sf-fulfillment-icon">
                  <Icon name="shield" width={18} height={18} />
                </span>
                <div>
                  <strong>Проверенное качество</strong>
                  <small>Оригинальные и безопасные товары</small>
                </div>
              </div>
              <div className="sf-fulfillment">
                <span className="sf-fulfillment-icon">
                  <Icon name="refresh" width={18} height={18} />
                </span>
                <div>
                  <strong>Возврат и обмен</strong>
                  <small>В течение 14 дней</small>
                </div>
              </div>
              {phone && (
                <a className="sf-contact-link" href={'tel:' + phone}>
                  <Icon name="phone" width={15} height={15} />
                  Связаться с магазином
                </a>
              )}
            </div>
          </div>
        </aside>
        <div className="sf-detail-copy">
          <div className="sf-detail-tabs">
            <a href="#description">Описание</a>
            <a href="#details">Характеристики</a>
            <a href="#product-reviews">
              Отзывы{' '}
              {v.ratingCount && v.ratingCount > 0 ? `(${v.ratingCount})` : ''}
            </a>
          </div>
          <div className="sf-detail-bottom-grid">
            <section id="description">
              <p className="sf-product-description">
                {v.description ||
                  'Продавец ещё не добавил описание. Подробности можно уточнить в магазине.'}
              </p>
              <div className="sf-product-highlights">
                <div className="sf-highlight-chip">
                  <Icon name="shield" width={18} height={18} />
                  <span>Проверенное качество</span>
                </div>
                <div className="sf-highlight-chip">
                  <Icon name="refresh" width={18} height={18} />
                  <span>14 дней на возврат</span>
                </div>
                <div className="sf-highlight-chip">
                  <Icon name="bag" width={18} height={18} />
                  <span>Самовывоз и доставка</span>
                </div>
                <div className="sf-highlight-chip">
                  <Icon name="award" width={18} height={18} />
                  <span>Оригинальный товар</span>
                </div>
              </div>
            </section>
            <section id="details">
              <h2>Характеристики</h2>
              <dl className="sf-specs">
                <div>
                  <dt>Тип</dt>
                  <dd>{v.category || 'Товар магазина'}</dd>
                </div>
                <div>
                  <dt>Категория</dt>
                  <dd>{v.category || 'Без категории'}</dd>
                </div>
                {v.size && (
                  <div>
                    <dt>Размер</dt>
                    <dd>{v.size}</dd>
                  </div>
                )}
                {v.color && (
                  <div>
                    <dt>Цвет</dt>
                    <dd>{v.color}</dd>
                  </div>
                )}
                {v.sku && (
                  <div>
                    <dt>Артикул</dt>
                    <dd>{v.sku}</dd>
                  </div>
                )}
                <div>
                  <dt>Магазин</dt>
                  <dd>
                    <Link href={'/shop/' + v.store.slug}>{v.store.name}</Link>
                  </dd>
                </div>
                <div>
                  <dt>Доступный остаток</dt>
                  <dd>{v.available} шт.</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </article>
      <div id="product-reviews">
        <ReviewsWidget
          slug={v.store.slug}
          productId={v.id}
          initialAverage={v.ratingAverage}
          initialCount={v.ratingCount}
          title={`Отзывы о товаре «${v.name}»`}
        />
      </div>
      {related.length > 0 && (
        <section className="sf-panel sf-stack">
          <div className="sf-section-heading">
            <h2>Похожие товары</h2>
            <Link href={'/?category=' + encodeURIComponent(v.category)}>
              Смотреть все →
            </Link>
          </div>
          <div className="sf-related-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
