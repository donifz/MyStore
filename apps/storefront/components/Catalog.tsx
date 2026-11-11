import Link from 'next/link';
import MarketplaceHero from './storefront/MarketplaceHero';
import Icon, { CategoryIllustration } from './storefront/Icon';
import { notFound } from 'next/navigation';
import {
  publicApi,
  PublicApiError,
  Products,
  Store,
  Search,
  Page,
  query,
  CustomAttribute,
} from '../lib/public-api';
import Pagination from './Pagination';
import Refresh from './Refresh';
import { Alert, EmptyState, LinkButton } from './ui';
import ProductCard from './storefront/ProductCard';
import CatalogFilters from './storefront/CatalogFilters';
import CollapsibleFilters from './storefront/CollapsibleFilters';
import StorefrontBanner from './storefront/StorefrontBanner';
import StoreHeroSection from './storefront/StoreHeroSection';
import ReviewsWidget from './storefront/ReviewsWidget';
import { CartLink } from './CartProvider';

function pluralizeProducts(n: number): string {
  const abs = Math.abs(n) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) return `${n} товаров`;
  if (mod10 === 1) return `${n} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} товара`;
  return `${n} товаров`;
}

export default async function Catalog({
  search,
  slug,
}: {
  search: Search;
  slug?: string;
}) {
  const initialHome = !slug && Object.keys(search).length === 0;
  const filter = query(initialHome ? { inStock: 'true' } : search, slug);
  let products: Products, store: Store | undefined;
  let customAttributes: CustomAttribute[] = [];
  try {
    if (slug) {
      store = await publicApi<Store>('/stores/' + encodeURIComponent(slug));
      try {
        const raw = await publicApi<CustomAttribute[]>(
          '/stores/' + encodeURIComponent(slug) + '/custom-attributes',
        );
        customAttributes = Array.isArray(raw) ? raw : [];
      } catch {}
    }
    products = await publicApi<Products>('/products?' + filter.params);
  } catch (e) {
    if (slug && e instanceof PublicApiError && e.status === 404) notFound();
    return (
      <Alert variant="error">
        <h1>Не удалось загрузить каталог</h1>
        <p>Повторите попытку через несколько минут.</p>
        <LinkButton variant="secondary" href={slug ? '/shop/' + slug : '/'}>
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
  const activeFilterCount = [
    filter.q,
    filter.category,
    filter.sort !== 'name',
    filter.minPrice,
    filter.maxPrice,
    filter.minRating,
    !initialHome && filter.inStock,
  ].filter(Boolean).length;
  const allLoadedInPage =
    !filter.category &&
    !filter.q &&
    !filter.minPrice &&
    !filter.maxPrice &&
    !filter.minRating &&
    products.total <= products.items.length;
  const filtersPanel = (
    <aside className="sf-catalog-sidebar">
      <CollapsibleFilters activeCount={activeFilterCount}>
        <CatalogFilters
          filter={filter}
          categories={products.categories}
          slug={slug}
          customAttributes={customAttributes}
          search={search}
        />
      </CollapsibleFilters>
    </aside>
  );
  return (
    <div className={store ? 'sf-stack' : 'sf-stack sf-home'}>
      <Refresh />
      {store && (
        <nav className="sf-breadcrumbs" aria-label="Хлебные крошки">
          <Link href="/">Главная</Link>
          <span>›</span>
          <Link href="/shops">Магазины</Link>
          <span>›</span>
          <span>{store.name}</span>
        </nav>
      )}
      {!store ? (
        <MarketplaceHero products={products.items} compact />
      ) : (
        <StoreHeroSection
          store={store}
          hasBanner={Boolean(store.banner?.imageDataUrl)}
        >
          <StorefrontBanner banner={store.banner} />
        </StoreHeroSection>
      )}
      <section id="catalog" className="sf-stack">
        {!store && products.categories.length > 0 && (
          <div
            className="sf-quick-categories"
            role="navigation"
            aria-label="Быстрый выбор категории"
          >
            <Link
              href={slug ? `/shop/${slug}#catalog` : '/#catalog'}
              className={`sf-quick-chip ${!filter.category ? 'sf-quick-chip--active' : ''}`}
            >
              <span className="sf-quick-chip__icon" aria-hidden="true">
                <Icon name="grid" width={22} height={22} />
              </span>
              <span className="sf-quick-chip__text">
                <strong>Все товары</strong>
                <small>
                  {!filter.category
                    ? pluralizeProducts(products.total)
                    : 'Весь каталог'}
                </small>
              </span>
            </Link>
            {products.categories.map((c) => {
              const catCount =
                filter.category === c
                  ? products.total
                  : allLoadedInPage
                    ? products.items.filter((item) => item.category === c)
                        .length
                    : null;
              return (
                <Link
                  key={c}
                  href={
                    slug
                      ? `/shop/${slug}?category=${encodeURIComponent(c)}#catalog`
                      : `/?category=${encodeURIComponent(c)}#catalog`
                  }
                  className={`sf-quick-chip ${filter.category === c ? 'sf-quick-chip--active' : ''}`}
                >
                  <span className="sf-quick-chip__icon" aria-hidden="true">
                    <CategoryIllustration category={c} />
                  </span>
                  <span className="sf-quick-chip__text">
                    <strong>{c}</strong>
                    <small>
                      {catCount !== null
                        ? pluralizeProducts(catCount)
                        : 'Открыть категорию'}
                    </small>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
        <div className="sf-catalog-layout">
          {filtersPanel}
          <div className="sf-catalog-results">
            <div className="sf-results-header">
              <div className="sf-results-title">
                <h2>
                  {store
                    ? filter.category || 'Все товары'
                    : filter.inStock
                      ? 'Товары в наличии'
                      : 'Все товары'}
                </h2>
                <span className="sf-count-pill">
                  Найдено {pluralizeProducts(products.total)}
                </span>
              </div>
              <div className="sf-results-toolbar">
                {!store && (
                  <nav
                    aria-label="Наличие товаров"
                    className="sf-home-availability"
                  >
                    <Link
                      href="/?inStock=true#catalog"
                      aria-current={filter.inStock ? 'page' : undefined}
                    >
                      В наличии
                    </Link>
                    <Link
                      href="/?inStock=false#catalog"
                      aria-current={!filter.inStock ? 'page' : undefined}
                    >
                      Все товары
                    </Link>
                  </nav>
                )}
                <Link
                  href={
                    slug
                      ? `/shop/${slug}?sort=${filter.sort === 'newest' ? 'price-asc' : 'newest'}#catalog`
                      : `/?sort=${filter.sort === 'newest' ? 'price-asc' : 'newest'}#catalog`
                  }
                  className="sf-sort-pill"
                >
                  {store ? (
                    <span className="sf-sort-pill__prefix">Сортировка:</span>
                  ) : (
                    <Icon name="sort" width={15} height={15} />
                  )}
                  <span>
                    {filter.sort === 'price-asc'
                      ? 'Сначала дешевле'
                      : filter.sort === 'price-desc'
                        ? 'Сначала дороже'
                        : 'Сначала новые'}
                  </span>
                  <Icon name="chevronDown" width={15} height={15} />
                </Link>
                <div className="sf-view-toggle" aria-hidden="true">
                  <span className="sf-view-btn sf-view-btn--active">
                    <Icon name="grid" width={16} height={16} />
                  </span>
                  <span className="sf-view-btn">
                    <Icon name="list" width={16} height={16} />
                  </span>
                </div>
              </div>
            </div>
            {store && products.categories.length > 0 && (
              <div
                className="sf-store-category-tiles"
                role="navigation"
                aria-label="Категории магазина"
              >
                <Link
                  href={`/shop/${slug}#catalog`}
                  className={`sf-store-cat-tile ${!filter.category ? 'sf-store-cat-tile--active' : ''}`}
                >
                  <span className="sf-store-cat-tile__icon">
                    <Icon name="grid" width={26} height={26} />
                  </span>
                  <strong>Все товары</strong>
                </Link>
                {products.categories.map((tileCat) => {
                  const isActive = filter.category === tileCat;
                  return (
                    <Link
                      key={tileCat}
                      href={`/shop/${slug}?category=${encodeURIComponent(tileCat)}#catalog`}
                      className={`sf-store-cat-tile ${isActive ? 'sf-store-cat-tile--active' : ''}`}
                    >
                      <span className="sf-store-cat-tile__icon">
                        <CategoryIllustration category={tileCat} />
                      </span>
                      <strong>{tileCat}</strong>
                    </Link>
                  );
                })}
              </div>
            )}
            {products.items.length ? (
              <div
                className={
                  store
                    ? 'sf-product-grid sf-product-grid--store'
                    : 'sf-product-grid'
                }
              >
                {products.items.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    storeView={Boolean(store)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={
                  filter.page > 1
                    ? 'arrow'
                    : filter.q || filter.category || filter.inStock
                      ? 'search'
                      : 'shop'
                }
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
                action={
                  filter.page > 1 ? (
                    <LinkButton
                      variant="primary"
                      href={slug ? '/shop/' + slug : '/'}
                    >
                      На первую страницу
                    </LinkButton>
                  ) : filter.q || filter.category || filter.inStock ? (
                    <LinkButton
                      variant="primary"
                      href={slug ? '/shop/' + slug : '/?inStock=false#catalog'}
                    >
                      Сбросить фильтры
                    </LinkButton>
                  ) : (
                    <div className="sf-empty-button-group">
                      <LinkButton variant="primary" href="/shops">
                        Смотреть магазины
                      </LinkButton>
                      <LinkButton variant="secondary" href="/partner">
                        Стать продавцом
                      </LinkButton>
                    </div>
                  )
                }
              />
            )}
            <Pagination
              path={slug ? '/shop/' + slug : '/'}
              params={
                new URLSearchParams({
                  ...Object.fromEntries(filter.params),
                  ...(filter.minPrice ? { minPrice: filter.minPrice } : {}),
                  ...(filter.maxPrice ? { maxPrice: filter.maxPrice } : {}),
                  ...(filter.minRating ? { minRating: filter.minRating } : {}),
                })
              }
              page={filter.page}
              total={products.total}
            />
          </div>
        </div>
      </section>
      {store && (
        <div id="store-reviews">
          <ReviewsWidget
            slug={store.slug}
            initialAverage={store.ratingAverage}
            initialCount={store.ratingCount}
            title={`Отзывы о магазине «${store.name}»`}
          />
        </div>
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
              <Link href={'/shop/' + s.slug} key={s.slug}>
                <span className="sf-mini-logo">{s.name.slice(0, 1)}</span>
                <span>
                  <strong>{s.name}</strong>
                  <small>
                    <span className="sf-star-glyph" aria-hidden="true">
                      ★
                    </span>{' '}
                    {(s.ratingAverage || 4.8).toFixed(1).replace('.', ',')} ·{' '}
                    {s.city} · {s.productCount ?? 0} товаров
                  </small>
                </span>
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
