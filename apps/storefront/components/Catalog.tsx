import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  publicApi,
  PublicApiError,
  Products,
  Store,
  Search,
  query,
  formatSom,
} from '../lib/public-api';
import Pagination from './Pagination';
import Refresh from './Refresh';
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
      <section className="market-empty" role="alert">
        <h1>Не удалось загрузить каталог</h1>
        <p>Повторите попытку через несколько минут.</p>
        <a className="button" href={slug ? '/shops/' + slug : '/'}>
          Повторить
        </a>
      </section>
    );
  }
  return (
    <>
      <Refresh />
      <section className={'market-hero ' + (store ? 'store-hero' : '')}>
        <div>
          <p className="eyebrow">
            {store?.city || 'Всё начинается с хорошей находки'}
          </p>
          <h1>{store?.name || 'Найдите своё в магазинах рядом'}</h1>
          <p>
            {store?.description ||
              'Выбирайте товары местных магазинов. Смотрите цены и наличие, связывайтесь с продавцом напрямую.'}
          </p>
          {store ? (
            <a
              className="primary button"
              href={'tel:' + store.phone?.replace(/[^\d+]/g, '')}
            >
              Связаться с магазином
            </a>
          ) : (
            <Link className="primary button" href="/shops">
              Посмотреть магазины ↗
            </Link>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-bag">m.</span>
          <span className="art-label">Рядом с вами</span>
          <span className="art-dot" />
        </div>
      </section>
      {store && (
        <div className="store-info">
          <span>{store.address || 'Адрес уточните у продавца'}</span>
          <span>{store.hours || 'Часы работы уточните у продавца'}</span>
          <span>{store.phone}</span>
        </div>
      )}
      <section className="market-catalog">
        <div className="market-section-heading">
          <h2>{store ? 'Товары магазина' : 'Каталог товаров'}</h2>
          <span className="muted">{products.total} товаров</span>
        </div>
        <form
          className="market-filters"
          action={slug ? '/shops/' + slug : '/'}
          method="get"
        >
          <label className="market-search">
            Поиск
            <input
              name="q"
              defaultValue={filter.q}
              maxLength={128}
              placeholder="Что вы ищете?"
            />
          </label>
          <label>
            Категория
            <select name="category" defaultValue={filter.category}>
              <option value="">Все категории</option>
              {filter.category &&
                !products.categories.includes(filter.category) && (
                  <option>{filter.category}</option>
                )}
              {products.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Сортировка
            <select name="sort" defaultValue={filter.sort}>
              <option value="name">По названию</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              name="inStock"
              type="checkbox"
              value="true"
              defaultChecked={filter.inStock}
            />
            В наличии
          </label>
          <button className="primary" type="submit">
            Найти
          </button>
        </form>
        <div className="product-grid">
          {products.items.map((v) => (
            <Link
              className="product-tile"
              key={v.id}
              href={'/shops/' + v.store.slug + '/products/' + v.id}
            >
              <div className="product-cover" aria-hidden="true">
                <>
                  {v.photoUrl ? (
                    <img src={v.photoUrl} alt="" loading="lazy" />
                  ) : (
                    <span>{v.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </>
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
        {!products.items.length && (
          <div className="market-empty">
            <span className="empty-symbol" aria-hidden="true">
              ↗
            </span>
            <h3>
              {filter.page > 1
                ? 'На этой странице товаров нет'
                : filter.q || filter.category || filter.inStock
                  ? 'Ничего не найдено'
                  : 'Товары пока не опубликованы.'}
            </h3>
            <p>
              {filter.page > 1
                ? 'Вернитесь на предыдущую страницу.'
                : filter.q || filter.category || filter.inStock
                  ? 'Попробуйте другой запрос или измените фильтры.'
                  : 'Магазины смогут добавить товары после настройки витрин.'}
            </p>
          </div>
        )}
        <Pagination
          path={slug ? '/shops/' + slug : '/'}
          params={filter.params}
          page={filter.page}
          total={products.total}
        />
      </section>
    </>
  );
}
