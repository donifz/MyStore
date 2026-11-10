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
import ReviewsWidget from './storefront/ReviewsWidget';
import { CartLink } from './CartProvider';
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
        customAttributes = await publicApi<CustomAttribute[]>(
          '/stores/' + encodeURIComponent(slug) + '/custom-attributes',
        );
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
    filter.inStock,
  ].filter(Boolean).length;
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
      {store && <StorefrontBanner banner={store.banner} />}
      {!store ? (
        <MarketplaceHero products={products.items} compact />
      ) : (
        <section className="sf-store-hero">
          <div className="sf-store-hero-main">
            <div className="sf-store-identity">
              <span className="sf-store-monogram" aria-hidden="true">
                <svg
                  viewBox="0 0 64 64"
                  width="54"
                  height="54"
                  fill="none"
                  stroke="#0062ff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="18" r="8" fill="#eaf2ff" />
                  <circle cx="46" cy="18" r="8" fill="#eaf2ff" />
                  <path
                    d="M14 34c0-11 8-18 18-18s18 7 18 18c0 12-7 18-18 18S14 46 14 34Z"
                    fill="#ffffff"
                  />
                  <circle
                    cx="25"
                    cy="31"
                    r="2.2"
                    fill="#0062ff"
                    stroke="none"
                  />
                  <circle
                    cx="39"
                    cy="31"
                    r="2.2"
                    fill="#0062ff"
                    stroke="none"
                  />
                  <ellipse
                    cx="32"
                    cy="37"
                    rx="4"
                    ry="2.8"
                    fill="#0062ff"
                    stroke="none"
                  />
                  <path d="M28 42c2 2 6 2 8 0" />
                </svg>
              </span>
              <div className="sf-store-identity-copy">
                <div className="sf-store-title-row">
                  <h1>{store.name}</h1>
                  <span
                    className="sf-verified-badge"
                    title="Проверенный магазин"
                    aria-hidden="true"
                  >
                    <Icon name="check" width={13} height={13} />
                  </span>
                </div>
                <p className="sf-store-subtitle">
                  {store.description || 'Магазин развивающих игрушек'}
                </p>
                <div className="sf-store-rating-row">
                  <span className="sf-star-glyph" aria-hidden="true">
                    ★
                  </span>
                  <strong>
                    {(store.ratingAverage || 4.8).toFixed(1).replace('.', ',')}
                  </strong>
                  <span>({store.ratingCount || 320} отзывов)</span>
                </div>
              </div>
            </div>
            <div className="sf-store-hero-art" aria-hidden="true">
              <svg
                viewBox="0 0 680 170"
                fill="none"
                preserveAspectRatio="xMidYMax slice"
              >
                <defs>
                  <linearGradient id="furHeroBear" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#e2ab72" />
                    <stop offset="100%" stopColor="#b57940" />
                  </linearGradient>
                </defs>
                <path
                  d="M40 52c0-10 8-18 18-18 7 0 13 4 16 10 3-2 6-3 10-3 9 0 16 7 16 16H40v-5Z"
                  fill="#ffffff"
                  opacity="0.7"
                />
                <path
                  d="M420 42c0-11 9-20 20-20 8 0 15 5 18 12 3-2 7-3 11-3 10 0 18 8 18 18h-67v-7Z"
                  fill="#ffffff"
                  opacity="0.75"
                />
                {/* Toy blocks left */}
                <rect
                  x="92"
                  y="134"
                  width="46"
                  height="34"
                  rx="4"
                  fill="#22c55e"
                />
                <rect
                  x="114"
                  y="142"
                  width="54"
                  height="26"
                  rx="4"
                  fill="#ef4444"
                />
                <rect
                  x="156"
                  y="72"
                  width="44"
                  height="96"
                  rx="5"
                  fill="#eab308"
                />
                <rect
                  x="164"
                  y="64"
                  width="12"
                  height="10"
                  rx="2"
                  fill="#ca8a04"
                />
                <rect
                  x="182"
                  y="64"
                  width="12"
                  height="10"
                  rx="2"
                  fill="#ca8a04"
                />
                {/* Rocket ship */}
                <path d="M220 168l8-22h28l8 22h-44Z" fill="#ef4444" />
                <path
                  d="M242 54c14 18 20 42 20 74h-40c0-32 6-56 20-74Z"
                  fill="#ffffff"
                />
                <path
                  d="M242 54c7 9 12 20 15 34h-30c3-14 8-25 15-34Z"
                  fill="#ef4444"
                />
                <circle
                  cx="242"
                  cy="106"
                  r="10"
                  fill="#38bdf8"
                  stroke="#1d4ed8"
                  strokeWidth="3"
                />
                {/* Center Plush Teddy Bear */}
                <circle cx="294" cy="34" r="22" fill="url(#furHeroBear)" />
                <circle cx="294" cy="34" r="12" fill="#f7d9b9" />
                <circle cx="378" cy="34" r="22" fill="url(#furHeroBear)" />
                <circle cx="378" cy="34" r="12" fill="#f7d9b9" />
                <ellipse
                  cx="336"
                  cy="148"
                  rx="56"
                  ry="42"
                  fill="url(#furHeroBear)"
                />
                <ellipse cx="336" cy="152" rx="32" ry="26" fill="#f7d9b9" />
                <circle cx="336" cy="70" r="46" fill="url(#furHeroBear)" />
                <ellipse cx="336" cy="82" rx="22" ry="17" fill="#f7d9b9" />
                <circle cx="318" cy="62" r="5.5" fill="#1e293b" />
                <circle cx="354" cy="62" r="5.5" fill="#1e293b" />
                <ellipse cx="336" cy="76" rx="8" ry="5.5" fill="#451a03" />
                <path
                  d="M328 86c4 4 12 4 16 0"
                  stroke="#451a03"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M312 112l24 10 24-10-7 20-17-7-17 7-7-20Z"
                  fill="#78350f"
                />
                {/* Right blocks & Rainbow Pyramid */}
                <rect
                  x="390"
                  y="124"
                  width="44"
                  height="44"
                  rx="4"
                  fill="#16a34a"
                />
                <rect
                  x="396"
                  y="94"
                  width="34"
                  height="30"
                  rx="4"
                  fill="#2563eb"
                />
                <rect
                  x="442"
                  y="144"
                  width="68"
                  height="18"
                  rx="9"
                  fill="#16a34a"
                />
                <rect
                  x="450"
                  y="126"
                  width="52"
                  height="18"
                  rx="9"
                  fill="#3b82f6"
                />
                <rect
                  x="458"
                  y="108"
                  width="36"
                  height="18"
                  rx="9"
                  fill="#eab308"
                />
                <rect
                  x="464"
                  y="90"
                  width="24"
                  height="18"
                  rx="9"
                  fill="#f97316"
                />
                <circle cx="476" cy="78" r="10" fill="#ef4444" />
                {/* Wooden Train */}
                <rect
                  x="518"
                  y="126"
                  width="64"
                  height="30"
                  rx="5"
                  fill="#ef4444"
                />
                <rect
                  x="524"
                  y="98"
                  width="30"
                  height="28"
                  rx="4"
                  fill="#eab308"
                />
                <rect
                  x="560"
                  y="106"
                  width="14"
                  height="20"
                  rx="3"
                  fill="#2563eb"
                />
                <circle cx="534" cy="158" r="10" fill="#1e293b" />
                <circle cx="534" cy="158" r="5" fill="#fbbf24" />
                <circle cx="566" cy="158" r="10" fill="#1e293b" />
                <circle cx="566" cy="158" r="5" fill="#fbbf24" />
              </svg>
              <div className="sf-store-hero-slogan">
                <span>Играй,</span>
                <span>развивайся,</span>
                <span>открывай</span>
                <span>новое!</span>
              </div>
            </div>
          </div>
          <div className="sf-store-hero-bar">
            <div
              className="sf-store-tabs"
              role="navigation"
              aria-label="Разделы магазина"
            >
              <a href="#catalog" className="sf-store-tab sf-store-tab--active">
                Товары
              </a>
              <a href="#store-about" className="sf-store-tab">
                О магазине
              </a>
              <a href="#store-reviews" className="sf-store-tab">
                Отзывы ({store.ratingCount || 320})
              </a>
            </div>
            <div className="sf-store-bar-actions">
              {phone && (
                <a
                  className="sf-store-phone-link"
                  href={'tel:' + phone}
                  aria-label="Позвонить в магазин"
                >
                  <Icon name="phone" width={16} height={16} />
                </a>
              )}
              <button type="button" className="sf-store-follow-btn">
                <Icon name="heart" width={16} height={16} />
                <span>Подписаться</span>
              </button>
              <button
                type="button"
                className="sf-store-share-btn"
                aria-label="Поделиться"
              >
                <Icon name="share" width={16} height={16} />
              </button>
            </div>
          </div>
          <div id="store-about" className="sf-store-info" hidden>
            <span>{store.address || 'Адрес уточните у продавца'}</span>
            <span>{store.hours || 'Часы работы уточните у продавца'}</span>
          </div>
        </section>
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
                <small>{products.total} товаров</small>
              </span>
            </Link>
            {products.categories.map((c) => {
              const catCount =
                products.items.filter((item) => item.category === c).length ||
                products.total;
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
                    <small>{catCount} товаров</small>
                  </span>
                </Link>
              );
            })}
            <Link
              href={slug ? `/shop/${slug}#catalog` : '/#catalog'}
              className="sf-quick-chip sf-quick-chip--more"
            >
              <span>Ещё</span>
              <Icon name="chevronDown" width={16} height={16} />
            </Link>
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
                  Найдено {products.total} товаров
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
            {store && (
              <div
                className="sf-store-category-tiles"
                role="navigation"
                aria-label="Категории магазина"
              >
                {[
                  'Конструкторы',
                  'Робототехника',
                  'Развивающие',
                  'Настольные игры',
                  'Машинки',
                  'Куклы',
                ].map((tileCat, idx) => {
                  const isActive =
                    filter.category === tileCat ||
                    (!filter.category && idx === 0);
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
                <Link
                  href={`/shop/${slug}#catalog`}
                  className="sf-store-cat-tile sf-store-cat-tile--more"
                >
                  <span className="sf-store-cat-tile__icon">
                    <Icon name="grid" width={26} height={26} />
                  </span>
                  <strong>Ещё</strong>
                </Link>
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
            initialAverage={store.ratingAverage || 4.8}
            initialCount={store.ratingCount || 320}
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
