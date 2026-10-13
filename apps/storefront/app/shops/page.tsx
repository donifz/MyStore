import { publicApi, Page, Store, Search } from '../../lib/public-api';
import StoreCard from '../../components/storefront/StoreCard';
import MarketplaceHero from '../../components/storefront/MarketplaceHero';
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
import { metadata } from '../../lib/seo';
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
    Object.keys(await searchParams).length > 0,
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
      publicApi<{
        locations: { city: string; district: string }[];
        categories: string[];
      }>('/filters'),
    ]);
  } catch {
    return (
      <Alert variant="error">
        <h1>Не удалось загрузить магазины</h1>
        <LinkButton href="/shops">Повторить</LinkButton>
      </Alert>
    );
  }
  return (
    <div className="sf-stack">
      <Refresh />
      <MarketplaceHero shops />
      <form action="/shops" className="sf-shop-search sf-panel">
        <Input
          id="shop-search"
          label="Поиск магазина"
          name="q"
          defaultValue={value('q')}
          placeholder="Название магазина"
          maxLength={128}
        />
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
        <div className="sf-section-heading">
          <h2>Выберите свой магазин</h2>
          <span className="sf-muted">Найдено: {stores.total}</span>
        </div>
        {stores.items.length ? (
          <div className="sf-store-grid">
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
