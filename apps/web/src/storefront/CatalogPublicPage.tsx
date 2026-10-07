import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatSom } from '../api/money';
import { PublicProducts, PublicStore } from './types';
import { useResource } from './use-resource';
export function Pagination({
  page,
  total,
  size,
  busy,
  onPage,
}: {
  page: number;
  total: number;
  size: number;
  busy: boolean;
  onPage: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <button disabled={page === 1 || busy} onClick={() => onPage(page - 1)}>
        Назад
      </button>
      <span>Страница {page}</span>
      <button
        disabled={page * size >= total || busy}
        onClick={() => onPage(page + 1)}
      >
        Далее
      </button>
    </div>
  );
}
export default function CatalogPublicPage() {
  const { slug } = useParams(),
    [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(1000000, Number(params.get('page')) || 1));
  const q = params.get('q') ?? '',
    category = params.get('category') ?? '',
    sort = params.get('sort') ?? 'name',
    inStock = params.get('inStock') === 'true';
  const query = new URLSearchParams({
    q,
    category,
    sort,
    inStock: String(inStock),
    page: String(page),
    ...(slug ? { store: slug } : {}),
  });
  const products = useResource<PublicProducts>(
      '/public/products?' + query,
      true,
    ),
    store = useResource<PublicStore>(
      slug ? '/public/stores/' + encodeURIComponent(slug) : null,
      true,
    );
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }
  if (slug && store.status === 404)
    return (
      <section className="market-empty">
        <h1>Магазин пока недоступен</h1>
        <p>Его витрина скрыта или адрес изменился.</p>
        <Link to="/shops">Все магазины</Link>
      </section>
    );
  return (
    <>
      <section className={'market-hero ' + (slug ? 'store-hero' : '')}>
        <div>
          <p className="eyebrow">
            {slug
              ? (store.data?.city ?? 'Витрина магазина')
              : 'Всё начинается с хорошей находки'}
          </p>
          <h1>
            {slug
              ? (store.data?.name ?? 'Магазин')
              : 'Найдите своё в магазинах рядом'}
          </h1>
          <p>
            {slug
              ? store.data?.description
              : 'Выбирайте товары местных магазинов. Смотрите цены и наличие, связывайтесь с продавцом напрямую.'}
          </p>
          {slug && store.data?.phone && (
            <a
              className="primary button"
              href={'tel:' + store.data.phone.replace(/[^\d+]/g, '')}
            >
              Связаться с магазином
            </a>
          )}
          {!slug && (
            <Link className="primary button" to="/shops">
              Посмотреть магазины <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-bag">m.</span>
          <span className="art-label">Рядом с вами</span>
          <span className="art-dot" />
        </div>
      </section>
      {slug && store.data && (
        <div className="store-info">
          <span>{store.data.address || 'Адрес уточните у продавца'}</span>
          <span>{store.data.hours || 'Часы работы уточните у продавца'}</span>
          <span>{store.data.phone}</span>
        </div>
      )}
      <section className="market-catalog">
        <div className="market-section-heading">
          <h2>{slug ? 'Товары магазина' : 'Каталог товаров'}</h2>
          <span className="muted">{products.data?.total ?? 0} товаров</span>
        </div>
        <div className="market-filters">
          <label className="market-search">
            Поиск
            <input
              value={q}
              maxLength={128}
              placeholder="Что вы ищете?"
              onChange={(e) => change('q', e.target.value)}
            />
          </label>
          <label>
            Категория
            <select
              value={category}
              onChange={(e) => change('category', e.target.value)}
            >
              <option value="">Все категории</option>
              {category && !products.data?.categories.includes(category) && (
                <option value={category}>{category}</option>
              )}
              {products.data?.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Сортировка
            <select
              value={sort}
              onChange={(e) => change('sort', e.target.value)}
            >
              <option value="name">По названию</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => change('inStock', String(e.target.checked))}
            />
            В наличии
          </label>
        </div>
        {(products.error || store.error) && (
          <p className="error" role="alert">
            {products.error || store.error}{' '}
            <button onClick={() => window.location.reload()}>Повторить</button>
          </p>
        )}
        {products.loading && (
          <p role="status" className="muted">
            Обновляем каталог…
          </p>
        )}
        {!products.error && (
          <div className="product-grid">
            {products.data?.items.map((v) => (
              <Link
                className="product-tile"
                key={v.id}
                to={'/shops/' + v.store.slug + '/products/' + v.id}
              >
                <div className="product-cover" aria-hidden="true">
                  <span>{v.name.slice(0, 1).toUpperCase()}</span>
                  <small>{v.category || 'Товар магазина'}</small>
                </div>
                <div className="product-copy">
                  <p className="product-store">
                    {v.store.name} · {v.store.city}
                  </p>
                  <h3>{v.name}</h3>
                  <div className="product-bottom">
                    <strong>{formatSom(v.salePriceMinor)}</strong>
                    <span className={'stock ' + (!v.available ? 'empty' : '')}>
                      {v.available ? 'В наличии' : 'Нет в наличии'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!products.loading &&
          !products.error &&
          !products.data?.items.length && (
            <div className="market-empty">
              <span className="empty-symbol" aria-hidden="true">
                ↗
              </span>
              <h3>
                {page > 1
                  ? 'На этой странице товаров нет'
                  : q || category || inStock
                    ? 'Ничего не найдено'
                    : 'Товары пока не опубликованы.'}
              </h3>
              <p>
                {page > 1
                  ? 'Вернитесь на предыдущую страницу.'
                  : q || category || inStock
                    ? 'Попробуйте другой запрос или измените фильтры.'
                    : 'Магазины смогут добавить товары после настройки витрин.'}
              </p>
            </div>
          )}
        {products.data && (products.data.total > 24 || page > 1) && (
          <Pagination
            page={page}
            total={products.data.total}
            size={24}
            busy={products.loading}
            onPage={(n) => change('page', String(n))}
          />
        )}
      </section>
    </>
  );
}
