import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../api/types';
import { PublicStore } from './types';
import { useResource } from './use-resource';
import { Pagination } from './CatalogPublicPage';
export default function StoresPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '',
    page = Math.max(1, Number(params.get('page')) || 1);
  const r = useResource<Page<PublicStore>>(
    '/public/stores?' + new URLSearchParams({ q, page: String(page) }),
    true,
  );
  function change(k: string, v: string) {
    const next = new URLSearchParams(params);
    next.set(k, v);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }
  return (
    <>
      <section className="market-title">
        <p className="eyebrow">Каждый магазин — своя история</p>
        <h1>Магазины рядом</h1>
        <p>Знакомьтесь с продавцами и находите нужное в их каталогах.</p>
      </section>
      <label className="search-label">
        Найти магазин
        <input
          value={q}
          maxLength={128}
          placeholder="Название или город"
          onChange={(e) => change('q', e.target.value)}
        />
      </label>
      {r.error && (
        <p role="alert" className="error">
          {r.error}
        </p>
      )}
      {r.loading && <p role="status">Загрузка…</p>}
      <div className="store-grid">
        {!r.error &&
          r.data?.items.map((s) => (
            <Link className="store-tile" key={s.slug} to={'/shops/' + s.slug}>
              <span className="store-monogram">{s.name.slice(0, 1)}</span>
              <span className="eyebrow">{s.city}</span>
              <h2>{s.name}</h2>
              <p>{s.description || 'Откройте каталог магазина'}</p>
              <strong>Перейти в магазин ↗</strong>
            </Link>
          ))}
      </div>
      {!r.loading && !r.error && !r.data?.items.length && (
        <div className="market-empty">
          <h2>
            {page > 1 ? 'На этой странице магазинов нет' : 'Магазинов пока нет'}
          </h2>
          <p>
            {q
              ? 'Попробуйте другой запрос.'
              : 'Опубликованные витрины появятся здесь.'}
          </p>
        </div>
      )}
      {r.data && (r.data.total > 24 || page > 1) && (
        <Pagination
          page={page}
          total={r.data.total}
          size={24}
          busy={r.loading}
          onPage={(n) => change('page', String(n))}
        />
      )}
    </>
  );
}
