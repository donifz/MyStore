import ProductGallery from '../../../../../components/storefront/ProductGallery';
import ProductCard from '../../../../../components/storefront/ProductCard';
import FavoriteButton from '../../../../../components/storefront/FavoriteButton';
import Icon from '../../../../../components/storefront/Icon';
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
      <nav className="sf-breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>›</span>
        {v.category && (
          <>
            <Link href={'/?category=' + encodeURIComponent(v.category)}>
              {v.category}
            </Link>
            <span>›</span>
          </>
        )}
        <Link href={'/shop/' + v.store.slug}>{v.store.name}</Link>
        <span>›</span>
        <span>{v.name}</span>
      </nav>
      <div className="sf-mobile-product-heading">
        <p className="sf-eyebrow">{v.category || 'Товар магазина'}</p>
        <div className="sf-detail-title">
          <h1>{v.name}</h1>
          <FavoriteButton product={v} />
        </div>
      </div>
      <article className="sf-detail-layout">
        <ProductGallery
          photoUrl={v.photoUrl}
          photoUrls={v.photoUrls}
          name={v.name}
        />
        <div className="sf-detail-copy">
          <p className="sf-eyebrow">{v.category || 'Товар магазина'}</p>
          <div className="sf-detail-title">
            <h1>{v.name}</h1>
            <FavoriteButton product={v} />
          </div>
          <StockBadge available={v.available} detailed />
          <VariantSelector
            currentId={v.id}
            storeSlug={v.store.slug}
            variants={v.variants}
          />
          <div className="sf-detail-tabs">
            <a href="#description">Описание</a>
            <a href="#details">О товаре</a>
          </div>
          <section id="description">
            <h2>Описание</h2>
            <p className="sf-product-description">
              {v.description ||
                'Продавец ещё не добавил описание. Подробности можно уточнить в магазине.'}
            </p>
          </section>
          <section id="details">
            <h2>О товаре</h2>
            <dl className="sf-specs">
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
                <dt>Город</dt>
                <dd>{v.store.city || 'Уточняется'}</dd>
              </div>
              <div>
                <dt>Доступный остаток</dt>
                <dd>{v.available} шт.</dd>
              </div>
            </dl>
          </section>
        </div>
        <aside
          className="sf-purchase-panel sf-panel"
          aria-label="Покупка товара"
        >
          <Price minor={v.salePriceMinor} className="sf-detail-price" />
          <StockBadge available={v.available} />
          <Link className="sf-seller-box" href={'/shop/' + v.store.slug}>
            <span className="sf-mini-logo">{v.store.name.slice(0, 1)}</span>
            <span>
              <strong>{v.store.name}</strong>
              <small>{v.store.city}</small>
            </span>
            <Icon name="arrow" />
          </Link>
          {v.store.pickupEnabled !== false && (
            <div className="sf-fulfillment">
              <Icon name="shop" />
              <div>
                <strong>Самовывоз из магазина</strong>
                <small>{v.store.address || 'Адрес уточнит продавец'}</small>
                {v.store.hours && <small>{v.store.hours}</small>}
              </div>
            </div>
          )}
          {v.store.deliveryEnabled && (
            <div className="sf-fulfillment">
              <Icon name="truck" />
              <div>
                <strong>Доставка от магазина</strong>
                <small>Срок и стоимость по согласованию</small>
              </div>
            </div>
          )}
          <BuyButton product={v} />
          <p className="sf-muted">Оплата при получении</p>
          {phone && (
            <a className="sf-contact-link" href={'tel:' + phone}>
              Вопрос о товаре? Связаться с магазином
            </a>
          )}
        </aside>
      </article>
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
