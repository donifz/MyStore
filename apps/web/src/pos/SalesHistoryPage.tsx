import Pagination from '../components/Pagination';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { hasShopPermission, type Page, type SaleSummary } from '../api/types';
import { formatSom, formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';

function shortCheckCode(id: string) {
  return id.slice(0, 8).toUpperCase();
}

type SaleStatusFilter = 'all' | 'returned' | 'credit';

export default function SalesHistoryPage() {
  const { shopId } = useParams(),
    s = useSession(),
    [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'));
    return Number.isFinite(p) && p >= 1 ? p : 1;
  });
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'newest');
  const [method, setMethod] = useState(() => searchParams.get('method') ?? '');
  const [status, setStatus] = useState<SaleStatusFilter>(() => {
    const raw = searchParams.get('status');
    return raw === 'returned' || raw === 'credit' ? raw : 'all';
  });
  const [fromDate, setFromDate] = useState(
    () => searchParams.get('from') ?? '',
  );
  const [toDate, setToDate] = useState(() => searchParams.get('to') ?? '');
  const [data, setData] = useState<Page<SaleSummary> | null>(null);
  const [error, setError] = useState('');
  const shop = s.user?.shops.find((x) => x.id === shopId);
  const owner =
    hasShopPermission(shop, 'return') || hasShopPermission(shop, 'reports');

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (method) next.set('method', method);
    if (status !== 'all') next.set('status', status);
    if (fromDate) next.set('from', fromDate);
    if (toDate) next.set('to', toDate);
    if (sort !== 'newest') next.set('sort', sort);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [q, method, status, fromDate, toDate, sort, page, setSearchParams]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({
      page: String(page),
      sort,
    });
    if (method) params.set('method', method);
    if (q.trim()) params.set('q', q.trim());
    if (status !== 'all') params.set('status', status);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    api<Page<SaleSummary>>(`/shops/${shopId}/pos/sales?${params.toString()}`)
      .then((r) => {
        if (alive) {
          setData(r);
          setError('');
        }
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [shopId, page, sort, method, q, status, fromDate, toDate]);

  const hasActiveFilters =
    Boolean(q.trim()) ||
    Boolean(method) ||
    status !== 'all' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  function resetFilters() {
    setQ('');
    setMethod('');
    setStatus('all');
    setFromDate('');
    setToDate('');
    setSort('newest');
    setPage(1);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">История документов</p>
          <h1>Продажи и возвраты</h1>
          <p className="muted">
            {owner ? 'Продажи магазина' : 'Ваши продажи'}
            {data ? ` · ${data.total} чек.` : ''}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="panel sales-filter-bar" style={{ flexWrap: 'wrap' }}>
        <label className="search-label">
          Поиск чека
          <input
            type="search"
            value={q}
            placeholder="Чек, товар или штрихкод"
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Способ оплаты
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Все способы</option>
            <option value="cash">Наличные</option>
            <option value="card">Карта</option>
          </select>
        </label>
        <label>
          Статус
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as SaleStatusFilter);
              setPage(1);
            }}
          >
            <option value="all">Все чеки</option>
            <option value="returned">С возвратами</option>
            <option value="credit">В долг</option>
          </select>
        </label>
        <label>
          Период с
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Период по
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }}
          />
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
            <option value="total-desc">По сумме: больше</option>
            <option value="total-asc">По сумме: меньше</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            className="button secondary"
            style={{ alignSelf: 'flex-end' }}
            onClick={resetFilters}
          >
            Сбросить
          </button>
        )}
      </div>
      <div className="sales-history-list">
        {data?.items.map((sale) => {
          const methodLabel =
            sale.method === 'cash'
              ? 'Наличные'
              : sale.method === 'card'
                ? 'Карта'
                : 'Без записи оплаты';
          const methodTone =
            sale.method === 'cash'
              ? 'green'
              : sale.method === 'card'
                ? 'blue'
                : 'neutral';
          return (
            <section
              className="panel history-card sale-history-card"
              key={sale.id}
            >
              <div className="sale-history-card__main">
                <div className="sale-history-card__top">
                  <strong className="sale-history-card__amount">
                    {formatSom(sale.totalMinor)}
                  </strong>
                  <span className={`admin-kit-status ${methodTone}`}>
                    {methodLabel}
                  </span>
                  {sale.hasReturns && (
                    <span className="admin-kit-status amber">Возврат</span>
                  )}
                  {sale.isCredit && (
                    <span className="admin-kit-status amber">В долг</span>
                  )}
                </div>
                <div className="sale-history-card__meta">
                  <span>{formatDate(sale.createdAt)}</span>
                  <span className="sale-history-card__dot" aria-hidden="true">
                    ·
                  </span>
                  <span className="code" title={sale.id}>
                    Чек #{shortCheckCode(sale.id)}
                  </span>
                </div>
              </div>
              <Link
                className="button secondary sale-history-card__btn"
                to={sale.id}
              >
                Открыть продажу <span aria-hidden="true">→</span>
              </Link>
            </section>
          );
        })}
      </div>
      {data && !data.items.length && (
        <p className="empty-state">
          {hasActiveFilters
            ? 'По выбранным фильтрам продаж не найдено.'
            : 'Продаж пока нет.'}
        </p>
      )}
      {data && (
        <Pagination
          page={page}
          total={data.total}
          size={data.pageSize}
          onPage={setPage}
        />
      )}
    </>
  );
}
