import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Page, SaleSummary } from '../api/types';
import { formatSom, formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';
export default function SalesHistoryPage() {
  const { shopId } = useParams(),
    s = useSession(),
    [page, setPage] = useState(1),
    [data, setData] = useState<Page<SaleSummary> | null>(null),
    [error, setError] = useState('');
  const owner = s.user?.shops.find((x) => x.id === shopId)?.role === 'owner';
  useEffect(() => {
    let alive = true;
    api<Page<SaleSummary>>(`/shops/${shopId}/pos/sales?page=${page}`)
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
  }, [shopId, page]);
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
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Назад
        </button>
        <span>Страница {page}</span>
        <button
          disabled={!data || page * data.pageSize >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Далее
        </button>
      </div>
    </>
  );
}
