import Link from 'next/link';
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
      <section role="alert" className="market-empty">
        <h1>Не удалось загрузить магазины</h1>
        <a href="/shops">Повторить</a>
      </section>
    );
  }
  return (
    <>
      <Refresh />
      <section className="market-title">
        <p className="eyebrow">Каждый магазин — своя история</p>
        <h1>Магазины рядом</h1>
        <p>Знакомьтесь с продавцами и находите нужное в их каталогах.</p>
      </section>
      <form action="/shops" method="get">
        <label className="search-label">
          Найти магазин
          <input
            name="q"
            defaultValue={f.q}
            maxLength={128}
            placeholder="Название или город"
          />
        </label>
        <button className="primary">Найти</button>
      </form>
      <div className="store-grid">
        {stores.items.map((s) => (
          <Link className="store-tile" key={s.slug} href={'/shops/' + s.slug}>
            <span className="store-monogram">{s.name.slice(0, 1)}</span>
            <span className="eyebrow">{s.city}</span>
            <h2>{s.name}</h2>
            <p>{s.description || 'Откройте каталог магазина'}</p>
            <strong>Перейти в магазин ↗</strong>
          </Link>
        ))}
      </div>
      {!stores.items.length && (
        <div className="market-empty">
          <h2>
            {f.page > 1
              ? 'На этой странице магазинов нет'
              : 'Магазинов пока нет'}
          </h2>
          <p>
            {f.q
              ? 'Попробуйте другой запрос.'
              : 'Опубликованные витрины появятся здесь.'}
          </p>
        </div>
      )}
      <Pagination
        path="/shops"
        params={params}
        page={f.page}
        total={stores.total}
      />
    </>
  );
}
