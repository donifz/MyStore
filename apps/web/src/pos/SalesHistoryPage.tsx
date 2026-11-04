import Pagination from '../components/Pagination';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { hasShopPermission, type Page, type SaleSummary } from '../api/types';
import { formatSom, formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';
export default function SalesHistoryPage() {
  const { shopId } = useParams(),
    s = useSession(),
    [page, setPage] = useState(1),
    [sort, setSort] = useState('newest'),
    [method, setMethod] = useState(''),
    [data, setData] = useState<Page<SaleSummary> | null>(null),
    [error, setError] = useState('');
  const shop = s.user?.shops.find((x) => x.id === shopId);
  const owner =
    hasShopPermission(shop, 'return') || hasShopPermission(shop, 'reports');
  useEffect(() => {
    let alive = true;
    api<Page<SaleSummary>>(
      `/shops/${shopId}/pos/sales?page=${page}&sort=${sort}${method ? `&method=${method}` : ''}`,
    )
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
  }, [shopId, page, sort, method]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">История документов</p>
          <h1>Продажи и возвраты</h1>
          <p className="muted">{owner ? 'Продажи магазина' : 'Ваши продажи'}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="toolbar">
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
      </div>
      {data?.items.map((sale) => (
        <section className="panel history-card" key={sale.id}>
          <div>
            <strong>{formatSom(sale.totalMinor)}</strong>
            <p>
              {formatDate(sale.createdAt)} ·{' '}
              {sale.method === 'cash'
                ? 'Наличные'
                : sale.method === 'card'
                  ? 'Карта'
                  : 'Без записи оплаты'}
            </p>
            <small className="code">{sale.id}</small>
          </div>
          <Link className="button" to={sale.id}>
            Открыть продажу
          </Link>
        </section>
      ))}
      {data && !data.items.length && (
        <p className="empty-state">Продаж пока нет.</p>
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
