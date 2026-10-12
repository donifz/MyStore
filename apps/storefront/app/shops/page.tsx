import StoreCard from '../../components/storefront/StoreCard';
import {
  Input,
  Button,
  Alert,
  EmptyState,
  LinkButton,
} from '../../components/ui';
import { publicApi, Page, Store, Search, query } from '../../lib/public-api';
import { metadata } from '../../lib/seo';
import Pagination from '../../components/Pagination';
import Refresh from '../../components/Refresh';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return metadata(
    'Магазины Кыргызстана — MyStore',
    'Местные магазины и их каталоги.',
    '/shops',
    Object.keys(await searchParams).length > 0,
  );
}
export default async function Stores({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const f = query(await searchParams);
  const params = new URLSearchParams({ q: f.q, page: String(f.page) });
  let stores: Page<Store>;
  try {
    stores = await publicApi('/stores?' + params);
  } catch {
    return (
      <Alert variant="error">
        <h1>Не удалось загрузить магазины</h1>
        <LinkButton href="/shops" variant="secondary">
          Повторить
        </LinkButton>
      </Alert>
    );
  }
  return (
    <div className="sf-stack">
      <Refresh />
      <section className="sf-title">
        <p className="sf-eyebrow">Каждый магазин — своя история</p>
        <h1>Магазины рядом</h1>
        <p className="sf-muted">
          Знакомьтесь с продавцами и находите нужное в их каталогах.
        </p>
      </section>
      <form className="sf-shop-search" action="/shops" method="get">
        <Input
          id="shop-search"
          label="Найти магазин"
          name="q"
          defaultValue={f.q}
          maxLength={128}
          placeholder="Название или город"
        />
        <Button type="submit">Найти</Button>
      </form>
      {stores.items.length ? (
        <div className="sf-store-grid">
          {stores.items.map((store) => (
            <StoreCard key={store.slug} store={store} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            f.page > 1 ? 'На этой странице магазинов нет' : 'Магазинов пока нет'
          }
          description={
            f.q
              ? 'Попробуйте другой запрос.'
              : 'Опубликованные витрины появятся здесь.'
          }
        />
      )}
      <Pagination
        path="/shops"
        params={params}
        page={f.page}
        total={stores.total}
      />
    </div>
  );
}
