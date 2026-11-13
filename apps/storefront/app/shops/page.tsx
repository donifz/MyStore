import Link from 'next/link';
import { headers } from 'next/headers';
import {
  publicApi,
  publicFilters,
  Page,
  Store,
  Search,
  pluralizeStores,
} from '../../lib/public-api';
import StoreCard from '../../components/storefront/StoreCard';
import Icon, { CategoryIllustration } from '../../components/storefront/Icon';
import {
  Input,
  Select,
  Button,
  Alert,
  EmptyState,
  LinkButton,
} from '../../components/ui';
import Pagination from '../../components/Pagination';
import Refresh from '../../components/Refresh';
import { metadata, breadcrumbsJson } from '../../lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return metadata(
    'Магазины рядом — MyStore',
    'Магазины вашего города и их товары: актуальное наличие из кассы, быстрая выдача и контакты продавцов.',
    '/shops',
    {
      noindex: Object.keys(await searchParams).length > 0,
      image: '/osh-hero.webp',
    },
  );
}

export default async function Stores({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const value = (k: string) =>
    typeof search[k] === 'string' ? (search[k] as string) : '';
  const page = Math.max(
    1,
    Math.min(1000000, Math.trunc(Number(value('page'))) || 1),
  );
  const q = value('q').slice(0, 128);
  const city = value('city').slice(0, 80);
  const district = value('district').slice(0, 80);
  const category = value('category').slice(0, 80);

  const params = new URLSearchParams({
    q,
    city,
    district,
    category,
    page: String(page),
  });

  let stores: Page<Store>,
    filters: {
      locations: { city: string; district: string }[];
      categories: string[];
    };
  try {
    [stores, filters] = await Promise.all([
      publicApi<Page<Store>>('/stores?' + params),
      publicFilters(),
    ]);
  } catch {
    return (
      <Alert variant="error">
        <h1>Не удалось загрузить магазины</h1>
        <LinkButton href="/shops">Повторить</LinkButton>
      </Alert>
    );
  }

  const cities = [
    ...new Set(filters.locations.map((l) => l.city).filter(Boolean)),
  ];

  const activeTab = city ? 'nearby' : category ? 'popular' : 'all';

  const hasActiveFilters = Boolean(q || city || district || category);
  const nonce = (await headers()).get('x-nonce') || undefined;

  return (
    <div className="sf-stack sf-shops-page">
      <Refresh />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: breadcrumbsJson([
            { name: 'Главная', url: '/' },
            { name: 'Магазины', url: '/shops' },
          ]),
        }}
      />
      <nav className="sf-breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>›</span>
        <span>Магазины</span>
      </nav>

      {/* Hero Section */}
      <section
        className="sf-shops-hero sf-panel"
        aria-label="О каталоге магазинов"
      >
        <div className="sf-shops-hero__copy">
          <div className="sf-shops-hero__badge-row">
            <span className="sf-hero-tag">КАТАЛОГ МАГАЗИНОВ</span>
            <span className="sf-stores-open-pill">
              {pluralizeStores(stores.total)}
            </span>
          </div>
          <h1>
            Магазины вашего города.
            <br />
            <em>Честные остатки прямо из кассы</em>
          </h1>
          <p className="sf-shops-hero__desc">
            Знакомьтесь с проверенными локальными продавцами Кыргызстана,
            смотрите витрины с реальным наличием и выбирайте удобный самовывоз
            или доставку.
          </p>
          <div className="sf-shops-hero__badges">
            <div className="sf-shops-hero__badge">
              <span className="sf-shops-hero__badge-icon" aria-hidden="true">
                <Icon name="shield" width={14} height={14} />
              </span>
              <span>Проверенные продавцы</span>
            </div>
            <div className="sf-shops-hero__badge">
              <span className="sf-shops-hero__badge-icon" aria-hidden="true">
                <Icon name="box" width={14} height={14} />
              </span>
              <span>Синхронизация с кассой</span>
            </div>
            <div className="sf-shops-hero__badge">
              <span className="sf-shops-hero__badge-icon" aria-hidden="true">
                <Icon name="truck" width={14} height={14} />
              </span>
              <span>Самовывоз и доставка</span>
            </div>
            <div className="sf-shops-hero__badge">
              <span className="sf-shops-hero__badge-icon" aria-hidden="true">
                <Icon name="phone" width={14} height={14} />
              </span>
              <span>Прямой контакт по WhatsApp</span>
            </div>
          </div>
        </div>

        <div className="sf-shops-hero__aside" aria-hidden="true">
          <div className="sf-shops-hero__stat-card">
            <span className="sf-shops-hero__stat-num">{stores.total}</span>
            <span className="sf-shops-hero__stat-label">
              {pluralizeStores(stores.total)} в каталоге
            </span>
            <div className="sf-shops-hero__stat-indicator">
              <span className="sf-home-store-status__dot" />
              <span>Актуально сейчас</span>
            </div>
          </div>
          <div className="sf-shops-hero__feature-card">
            <span className="sf-shops-hero__feature-icon">
              <Icon name="shop" width={22} height={22} />
            </span>
            <div>
              <strong>Локальный бизнес</strong>
              <small>Покупайте у магазинов вашего города</small>
            </div>
          </div>
        </div>
      </section>

      {/* Quick City Selector Bar */}
      {cities.length > 0 && (
        <div
          className="sf-shops-quick-cities"
          role="navigation"
          aria-label="Выбор города"
        >
          <span className="sf-shops-quick-label">
            <Icon name="pin" width={15} height={15} />
            <span>Город:</span>
          </span>
          <div className="sf-shops-quick-chips">
            <Link
              href={
                category
                  ? `/shops?category=${encodeURIComponent(category)}`
                  : '/shops'
              }
              className={`sf-city-chip ${!city ? 'sf-city-chip--active' : ''}`}
            >
              Все города
            </Link>
            {cities.map((c) => (
              <Link
                key={c}
                href={`/shops?city=${encodeURIComponent(c)}${category ? `&category=${encodeURIComponent(category)}` : ''}`}
                className={`sf-city-chip ${city === c ? 'sf-city-chip--active' : ''}`}
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Category Selector Bar */}
      {filters.categories.length > 0 && (
        <div
          className="sf-quick-categories sf-shops-quick-categories"
          role="navigation"
          aria-label="Быстрый выбор категории"
        >
          <Link
            href={city ? `/shops?city=${encodeURIComponent(city)}` : '/shops'}
            className={`sf-quick-chip ${!category ? 'sf-quick-chip--active' : ''}`}
          >
            <span className="sf-quick-chip__icon" aria-hidden="true">
              <Icon name="grid" width={22} height={22} />
            </span>
            <span className="sf-quick-chip__text">
              <strong>Все категории</strong>
              <small>{pluralizeStores(stores.total)}</small>
            </span>
          </Link>
          {filters.categories.slice(0, 10).map((cat) => (
            <Link
              key={cat}
              href={`/shops?${new URLSearchParams({ ...(city ? { city } : {}), category: cat }).toString()}`}
              className={`sf-quick-chip ${category === cat ? 'sf-quick-chip--active' : ''}`}
            >
              <span className="sf-quick-chip__icon" aria-hidden="true">
                <CategoryIllustration category={cat} />
              </span>
              <span className="sf-quick-chip__text">
                <strong>{cat}</strong>
                <small>Магазины</small>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Search and Filter Form */}
      <form action="/shops" className="sf-shops-search-bar" role="search">
        <div className="sf-shops-search-input-wrap">
          <span className="sf-shops-search-icon" aria-hidden="true">
            <Icon name="search" width={18} height={18} />
          </span>
          <Input
            id="shop-search"
            label="Поиск магазина"
            name="q"
            defaultValue={q}
            placeholder="Поиск магазина по названию..."
            maxLength={128}
          />
        </div>
        <Select id="shop-city" label="Город" name="city" defaultValue={city}>
          <option value="">Все города</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          id="shop-district"
          label="Район"
          name="district"
          defaultValue={district}
        >
          <option value="">Все районы</option>
          {[
            ...new Set(
              filters.locations
                .filter((l) => (!city || l.city === city) && l.district)
                .map((l) => l.district),
            ),
          ].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select
          id="shop-category"
          label="Категория"
          name="category"
          defaultValue={category}
        >
          <option value="">Все категории</option>
          {filters.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="sf-shops-search-actions">
          <Button type="submit">Найти</Button>
          {hasActiveFilters && (
            <Link
              href="/shops"
              className="sf-shops-reset-link"
              title="Сбросить все фильтры"
            >
              Сброс
            </Link>
          )}
        </div>
      </form>

      {/* Results Header with Tabs */}
      <div className="sf-shops-page-head">
        <div className="sf-shops-results-title-group">
          <h1>{city ? `Магазины · ${city}` : 'Магазины'}</h1>
          <span className="sf-shops-count-badge">
            {pluralizeStores(stores.total)}
          </span>
        </div>
        <div className="sf-orders-filter-tabs" role="navigation">
          <Link
            href="/shops"
            className={`sf-orders-tab-pill ${activeTab === 'all' ? 'sf-orders-tab-pill--active' : ''}`}
          >
            Все
          </Link>
          <Link
            href="/shops?city=Ош"
            className={`sf-orders-tab-pill ${activeTab === 'nearby' ? 'sf-orders-tab-pill--active' : ''}`}
          >
            Рядом
          </Link>
          <Link
            href="/shops?category=Конструкторы"
            className={`sf-orders-tab-pill ${activeTab === 'popular' ? 'sf-orders-tab-pill--active' : ''}`}
          >
            Популярные
          </Link>
        </div>
      </div>

      {/* Store Grid or Empty State */}
      <section id="shops" className="sf-stack">
        {stores.items.length ? (
          <div className="sf-store-list-grid">
            {stores.items.map((s, index) => (
              <StoreCard key={s.slug} store={s} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Магазины не найдены"
            description="Попробуйте изменить поисковый запрос, выбрать другой город или категорию."
            action={
              <LinkButton href="/shops" variant="secondary">
                Сбросить фильтры
              </LinkButton>
            }
          />
        )}

        {/* Partner CTA Card */}
        <section
          className="sf-partner-cta-card"
          aria-label="Стать продавцом на MyStore"
        >
          <div className="sf-partner-cta-card__content">
            <span className="sf-partner-cta-card__badge">ДЛЯ БИЗНЕСА</span>
            <h2>Откройте онлайн-витрину вашего магазина на MyStore</h2>
            <p>
              Подключайтесь бесплатно: ведите кассовый учёт, синхронизируйте
              реальные остатки товаров и получайте заказы от покупателей вашего
              города.
            </p>
            <div className="sf-partner-cta-card__perks">
              <div className="sf-partner-cta-card__perk">
                <span className="sf-partner-cta-card__check" aria-hidden="true">
                  ✓
                </span>
                <span>Бесплатный старт и запуск витрины за 1 день</span>
              </div>
              <div className="sf-partner-cta-card__perk">
                <span className="sf-partner-cta-card__check" aria-hidden="true">
                  ✓
                </span>
                <span>Удобная POS-касса, чеки и складской учёт</span>
              </div>
              <div className="sf-partner-cta-card__perk">
                <span className="sf-partner-cta-card__check" aria-hidden="true">
                  ✓
                </span>
                <span>Заказы на самовывоз и доставку прямо в WhatsApp</span>
              </div>
            </div>
          </div>
          <div className="sf-partner-cta-card__action">
            <Link
              href="/partner"
              className="sf-button sf-button--primary sf-partner-cta-card__btn"
            >
              Стать продавцом <Icon name="arrow" width={18} height={18} />
            </Link>
            <small className="sf-partner-cta-card__note">
              Подключение бесплатно · Без абонентской платы
            </small>
          </div>
        </section>

        <Pagination
          path="/shops"
          params={params}
          page={page}
          total={stores.total}
        />
      </section>
    </div>
  );
}
