import Link from 'next/link';
import MarketplaceHero from './storefront/MarketplaceHero';
import Icon from './storefront/Icon';
import { notFound } from 'next/navigation';
import {
  publicApi,
  PublicApiError,
  Products,
  Store,
  Search,
  Page,
  query,
} from '../lib/public-api';
import Pagination from './Pagination';
import Refresh from './Refresh';
import { Alert, EmptyState, LinkButton } from './ui';
import ProductCard from './storefront/ProductCard';
import CatalogFilters from './storefront/CatalogFilters';
export default async function Catalog({
  search,
  slug,
}: {
  search: Search;
  slug?: string;
}) {
  const filter = query(search, slug);
  let products: Products, store: Store | undefined;
  try {
    if (slug)
      store = await publicApi<Store>('/stores/' + encodeURIComponent(slug));
    products = await publicApi<Products>('/products?' + filter.params);
  } catch (e) {
    if (slug && e instanceof PublicApiError && e.status === 404) notFound();
    return (
      <Alert variant="error">
        <h1>Не удалось загрузить каталог</h1>
        <p>Повторите попытку через несколько минут.</p>
        <LinkButton variant="secondary" href={slug ? '/shops/' + slug : '/'}>
          Повторить
        </LinkButton>
      </Alert>
    );
  }
  let stores: Store[] = [];
  if (!slug) {
    try {
      stores = (
        await publicApi<Page<Store>>(
          '/stores?pageSize=6&city=' + encodeURIComponent(filter.city),
        )
      ).items;
    } catch {
      /* Catalogue remains usable. */
    }
  }
  const phone = store?.phone?.replace(/[^\d+]/g, '');
  return (
    <div className="sf-stack">
      <Refresh />
      {!store ? (
        <MarketplaceHero products={products.items} />
      ) : (
        <section className="sf-store-hero">
          <div className="sf-store-identity">
            <span className="sf-store-monogram">{store.name.slice(0, 1)}</span>
            <div>
              <p className="sf-eyebrow">
                {store.city}
                {store.district ? ' · ' + store.district : ''}
              </p>
              <h1>{store.name}</h1>
              <p>{store.description || 'Товары вашего местного магазина'}</p>
            </div>
          </div>
          <div className="sf-store-hero-actions">
            {phone && (
              <a className="sf-button sf-button--primary" href={'tel:' + phone}>
                Связаться с магазином
              </a>
            )}
            <span>
              {store.pickupEnabled !== false ? 'Самовывоз' : ''}
              {store.pickupEnabled !== false && store.deliveryEnabled
                ? ' · '
                : ''}
              {store.deliveryEnabled ? 'Доставка' : ''}
            </span>
          </div>
        </section>
      )}
      {!store && stores.length > 0 && (
        <section className="sf-stores-strip sf-panel">
          <div className="sf-section-heading">
            <h2>Магазины рядом</h2>
            <Link href="/shops">
              Все магазины <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="sf-stores-strip-grid">
            {stores.map((s) => (
              <Link href={'/shops/' + s.slug} key={s.slug}>
                <span className="sf-mini-logo">{s.name.slice(0, 1)}</span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    {s.city} · {s.productCount ?? 0} товаров
                  </small>
                </span>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}
      {store && (
        <div className="sf-store-info">
          <span>{store.address || 'Адрес уточните у продавца'}</span>
          <span>{store.hours || 'Часы работы уточните у продавца'}</span>
          {store.phone && <span>{store.phone}</span>}
        </div>
      )}
      <section id="catalog" className="sf-stack">
        <div className="sf-section-heading">
          <div>
            <p className="sf-eyebrow">Выбирайте своё</p>
            <h2>{store ? 'Товары магазина' : 'Все товары'}</h2>
          </div>
          <span className="sf-muted">{products.total} товаров</span>
        </div>
        <div className="sf-catalog-layout">
          <aside className="sf-catalog-sidebar">
            <details open>
              <summary>
                <Icon name="menu" />
                Фильтры
              </summary>
              <CatalogFilters
                filter={filter}
                categories={products.categories}
                slug={slug}
              />
            </details>
          </aside>
          <div className="sf-catalog-results">
            {products.items.length ? (
              <div className="sf-product-grid">
                {products.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  filter.page > 1
                    ? 'На этой странице товаров нет'
                    : filter.q || filter.category || filter.inStock
                      ? 'Ничего не найдено'
                      : 'Товары пока не опубликованы.'
                }
                description={
                  filter.page > 1
                    ? 'Вернитесь на предыдущую страницу.'
                    : filter.q || filter.category || filter.inStock
                      ? 'Попробуйте другой запрос или измените фильтры.'
                      : 'Магазины смогут добавить товары после настройки витрин.'
                }
              />
            )}
            <Pagination
              path={slug ? '/shops/' + slug : '/'}
              params={
                new URLSearchParams({
                  ...Object.fromEntries(filter.params),
                  ...(filter.minPrice ? { minPrice: filter.minPrice } : {}),
                  ...(filter.maxPrice ? { maxPrice: filter.maxPrice } : {}),
                })
              }
              page={filter.page}
              total={products.total}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
