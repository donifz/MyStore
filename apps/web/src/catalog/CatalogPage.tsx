import Pagination from '../components/Pagination';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Page, Variant } from '../api/types';
import { formatSom } from '../api/money';
import { formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';
import BarcodeLabel from './BarcodeLabel';
import ProductThumb from './ProductThumb';

export default function CatalogPage() {
  const { shopId } = useParams(),
    session = useSession(),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [archived, setArchived] = useState(false),
    [sort, setSort] = useState('newest'),
    [stockFilter, setStockFilter] = useState<
      'all' | 'in_stock' | 'low' | 'out'
    >('all'),
    [data, setData] = useState<Page<Variant> | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [barcodeProduct, setBarcodeProduct] = useState<Variant | null>(null);
  const role = session.user?.shops.find((x) => x.id === shopId)?.role;
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const stockParam = stockFilter !== 'all' ? `&stock=${stockFilter}` : '';
    api<Page<Variant>>(
      `/shops/${shopId}/variants?q=${encodeURIComponent(q)}&page=${page}&archived=${archived}&sort=${sort}${stockParam}`,
    )
      .then((r) => {
        if (alive) setData(r);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shopId, q, page, archived, stockFilter, sort]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Каталог магазина</p>
          <h1>Товары</h1>
          <p className="muted">Цены и доступные остатки</p>
        </div>
        {role !== 'cashier' && (
          <div className="order-actions">
            <Link className="primary button" to="new">
              Добавить товар
            </Link>
          </div>
        )}
      </div>
      <section className="panel">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <label className="search-label">
            Поиск
            <input
              value={q}
              placeholder="Название или штрихкод"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div
            className="filter-group"
            role="tablist"
            aria-label="Статус товаров"
            style={{ display: 'inline-flex', gap: '0.5rem' }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={!archived}
              className={`button ${!archived ? 'primary' : 'secondary'}`}
              onClick={() => {
                setArchived(false);
                setPage(1);
              }}
            >
              Активные
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={archived}
              className={`button ${archived ? 'primary' : 'secondary'}`}
              onClick={() => {
                setArchived(true);
                setPage(1);
              }}
            >
              В архиве
            </button>
          </div>
          <label>
            Наличие
            <select
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(
                  e.target.value as 'all' | 'in_stock' | 'low' | 'out',
                );
                setPage(1);
              }}
            >
              <option value="all">Все остатки</option>
              <option value="in_stock">В наличии (&gt; 0)</option>
              <option value="low">Мало на складе (1–5 шт.)</option>
              <option value="out">Нет в наличии (0 шт.)</option>
            </select>
          </label>
          <label>
            Сортировка
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Сначала новые</option>
              <option value="oldest">Сначала старые</option>
              <option value="name">Название А–Я</option>
              <option value="name-desc">Название Я–А</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дороже</option>
              <option value="popular">Часто продаются</option>
            </select>
          </label>
          <span
            className="muted"
            style={{ marginLeft: 'auto', alignSelf: 'center' }}
          >
            {data?.total ?? 0} товаров
          </span>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {loading && <p aria-live="polite">Загрузка…</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Товар</th>
                <th>Добавлен</th>
                {role !== 'cashier' && <th>Закупочная</th>}
                <th>Цена</th>
                <th>Доступно</th>
                <th>Резерв</th>
                <th className="no-print">Этикетка</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="catalog-product-cell">
                      <ProductThumb photoUrl={v.photoUrl} name={v.name} />
                      <div className="catalog-product-info">
                        <div className="catalog-product-title">
                          {role !== 'cashier' ? (
                            <Link to={v.id + '/edit'}>
                              <strong>{v.name}</strong>
                            </Link>
                          ) : (
                            <strong>{v.name}</strong>
                          )}
                          {(v.size || v.color) && (
                            <span className="muted">
                              {' '}
                              ({[v.size, v.color].filter(Boolean).join(', ')})
                            </span>
                          )}
                          {v.archived && (
                            <span
                              className="status-pill status-archived"
                              style={{ marginLeft: '0.5rem' }}
                            >
                              В архиве
                            </span>
                          )}
                        </div>
                        <small className="code">{v.barcode}</small>
                      </div>
                    </div>
                  </td>
                  <td>{v.createdAt ? formatDate(v.createdAt) : '—'}</td>
                  {role !== 'cashier' && (
                    <td>
                      {v.lastPurchaseMinor !== undefined
                        ? formatSom(v.lastPurchaseMinor)
                        : '—'}
                    </td>
                  )}
                  <td>{formatSom(v.salePriceMinor)}</td>
                  <td>
                    <span
                      className={
                        'stock ' +
                        (v.available
                          ? v.available <= 5
                            ? 'low'
                            : ''
                          : 'empty')
                      }
                    >
                      {v.available} шт.
                    </span>
                  </td>
                  <td>{v.reserved} шт.</td>
                  <td className="no-print">
                    <button type="button" onClick={() => setBarcodeProduct(v)}>
                      Штрихкод
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && !data?.items.length && (
          <p className="empty-state">
            {archived
              ? 'В архиве нет товаров.'
              : 'Товаров пока нет. Добавьте первую позицию.'}
          </p>
        )}
        {data && (
          <Pagination
            page={page}
            total={data.total}
            size={data.pageSize}
            busy={loading}
            onPage={setPage}
          />
        )}
      </section>
      {barcodeProduct && (
        <div
          className="barcode-dialog-backdrop"
          role="presentation"
          onClick={() => setBarcodeProduct(null)}
        >
          <section
            className="barcode-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Этикетка: ${barcodeProduct.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="barcode-dialog-heading">
              <h2>Этикетка товара</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setBarcodeProduct(null)}
              >
                ×
              </button>
            </div>
            <BarcodeLabel product={barcodeProduct} />
          </section>
        </div>
      )}
    </>
  );
}
