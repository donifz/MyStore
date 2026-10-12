import { notFound } from 'next/navigation';
import {
  publicApi,
  PublicApiError,
  Products,
  Store,
  Search,
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
  const phone = store?.phone?.replace(/[^\d+]/g, '');
  return (
    <div className="sf-stack">
      <Refresh />
      <section className={'sf-hero' + (store ? ' sf-hero--store' : '')}>
        <div className="sf-hero__copy">
          <p className="sf-eyebrow">
            {store?.city || 'Всё начинается с хорошей находки'}
          </p>
          <h1>{store?.name || 'Найдите своё в магазинах рядом'}</h1>
          <p className="sf-hero__description">
            {store?.description ||
              'Выбирайте товары местных магазинов. Смотрите цены и наличие, связывайтесь с продавцом напрямую.'}
          </p>
          {store ? (
            phone && (
              <a className="sf-button sf-button--primary" href={'tel:' + phone}>
                Связаться с магазином
              </a>
            )
          ) : (
            <LinkButton href="/shops">
              Посмотреть магазины <span aria-hidden="true">↗</span>
            </LinkButton>
          )}
        </div>
        <div className="sf-hero-art" aria-hidden="true">
          <span className="sf-hero-art__circle" />
          <span className="sf-hero-art__bag">
            <span>m.</span>
          </span>
          <span className="sf-hero-art__label">Хорошие находки рядом ↗</span>
          <span className="sf-hero-art__spark">✳</span>
        </div>
      </section>
      {store && (
        <div className="sf-store-info">
          <span>{store.address || 'Адрес уточните у продавца'}</span>
          <span>{store.hours || 'Часы работы уточните у продавца'}</span>
          {store.phone && <span>{store.phone}</span>}
        </div>
      )}
      <section className="sf-stack">
        <div className="sf-section-heading">
          <div>
            <p className="sf-eyebrow">Выбирайте своё</p>
            <h2>{store ? 'Товары магазина' : 'Каталог товаров'}</h2>
          </div>
          <span className="sf-muted">{products.total} товаров</span>
        </div>
        <CatalogFilters
          filter={filter}
          categories={products.categories}
          slug={slug}
        />
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
          params={filter.params}
          page={filter.page}
          total={products.total}
        />
      </section>
    </div>
  );
}
