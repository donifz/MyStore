import Link from 'next/link';
import { headers } from 'next/headers';
import {
  publicApi,
  publicFilters,
  Page,
  Store,
  Search,
} from '../../lib/public-api';
import StoreCard from '../../components/storefront/StoreCard';
import Icon from '../../components/storefront/Icon';
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
    'Магазины вашего города и их товары.',
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
  const params = new URLSearchParams({
    q: value('q').slice(0, 128),
    city: value('city').slice(0, 80),
    district: value('district').slice(0, 80),
    category: value('category').slice(0, 80),
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
  const activeTab = value('city')
    ? 'nearby'
    : value('category')
      ? 'popular'
      : 'all';
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

      <div className="sf-shops-page-head">
        <h1>Магазины</h1>
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

      <form action="/shops" className="sf-shops-search-bar">
        <div className="sf-shops-search-input-wrap">
          <Icon name="search" width={18} height={18} />
          <Input
            id="shop-search"
            label="Поиск магазина"
            name="q"
            defaultValue={value('q')}
            placeholder="Поиск магазина..."
            maxLength={128}
          />
        </div>
        <Select
          id="shop-city"
          label="Город"
          name="city"
          defaultValue={value('city')}
        >
          <option value="">Все города</option>
          {[...new Set(filters.locations.map((l) => l.city))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select
          id="shop-district"
          label="Район"
          name="district"
          defaultValue={value('district')}
        >
          <option value="">Все районы</option>
          {[
            ...new Set(
              filters.locations
                .filter(
                  (l) =>
                    (!value('city') || l.city === value('city')) && l.district,
                )
                .map((l) => l.district),
            ),
          ].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
        <Select
          id="shop-category"
          label="Категория"
          name="category"
          defaultValue={value('category')}
        >
          <option value="">Все категории</option>
          {filters.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Button type="submit">Найти</Button>
      </form>

      <section id="shops" className="sf-stack">
        {stores.items.length ? (
          <div className="sf-store-list-grid">
            {stores.items.map((s) => (
              <StoreCard key={s.slug} store={s} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Магазины не найдены"
            description="Попробуйте другой город или категорию."
            action={
              <LinkButton href="/shops" variant="secondary">
                Сбросить фильтры
              </LinkButton>
            }
          />
        )}
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
