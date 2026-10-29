import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { FinancialSummary } from '../api/types';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KGS',
  }).format(n / 100);

export default function ReportsPage() {
  const { shopId = '' } = useParams();
  const [data, setData] = useState<FinancialSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadSummary = useCallback(
    async (from?: string, to?: string) => {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams();
        if (from) query.set('from', new Date(from + 'T00:00:00').toISOString());
        if (to) query.set('to', new Date(to + 'T23:59:59.999').toISOString());
        const qs = query.toString();
        const res = await api<FinancialSummary>(
          `/shops/${shopId}/reports/summary${qs ? '?' + qs : ''}`,
        );
        setData(res);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    void loadSummary(fromDate, toDate);
  }, [shopId, loadSummary]);

  function handleApplyFilter(e: React.FormEvent) {
    e.preventDefault();
    void loadSummary(fromDate, toDate);
  }

  function handleResetFilter() {
    setFromDate('');
    setToDate('');
    void loadSummary('', '');
  }

  function applyPreset(daysBack: number | 'month') {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from = to;
    if (daysBack === 'month') {
      from = `${to.slice(0, 8)}01`;
    } else if (daysBack > 0) {
      const start = new Date(now);
      start.setDate(start.getDate() - daysBack);
      from = start.toISOString().slice(0, 10);
    }
    setFromDate(from);
    setToDate(to);
    void loadSummary(from, to);
  }

  const exportParams = new URLSearchParams();
  if (fromDate)
    exportParams.set('from', new Date(fromDate + 'T00:00:00').toISOString());
  if (toDate)
    exportParams.set('to', new Date(toDate + 'T23:59:59.999').toISOString());
  const exportQs = exportParams.toString();

  const cards: [string, string][] = data
    ? [
        ['Выручка за вычетом возвратов', money(data.revenueMinor)],
        [
          'Выручка в кассе (POS)',
          `${money(data.posSalesMinor ?? 0)} (${data.posSalesCount ?? 0} чеков)`,
        ],
        [
          'Выручка онлайн (Заказы)',
          `${money(data.onlineSalesMinor ?? 0)} (${data.onlineSalesCount ?? 0} заказов)`,
        ],
        ['Себестоимость проданного', money(data.costOfGoodsMinor)],
        ['Валовая прибыль', money(data.grossProfitMinor)],
        [
          'Возвраты покупателей',
          `${money(data.returnsMinor)} (${data.returnsCount ?? 0})`,
        ],
        [
          'Получено оплат',
          money(data.paymentsReceivedMinor - data.paymentsRefundedMinor),
        ],
        ['Наличные', money(data.cashReceivedMinor)],
        ['Карта', money(data.cardReceivedMinor)],
        ['Стоимость остатка', money(data.stockValueMinor)],
        [
          'Доступно / резерв',
          `${data.physicalUnits - data.reservedUnits} / ${data.reservedUnits}`,
        ],
        ['Товаров с низким остатком', String(data.lowStockCount)],
        ['Открытых заказов', String(data.openOrders)],
        [
          'Онлайн-заказов выдано',
          `${data.issuedOrders} (на ${money(data.issuedOrdersMinor ?? 0)})`,
        ],
        ['Закрытых смен', String(data.closedShifts)],
        ['Расхождение кассы', money(data.cashDiscrepancyMinor)],
      ]
    : [];

  return (
    <section className="reports-page page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Финансы и склад</p>
          <h1>Отчёты</h1>
        </div>
      </div>
      <p className="muted reports-explanation">
        Валовая прибыль не учитывает аренду, зарплаты, налоги и другие расходы
        бизнеса.
      </p>

      <form
        onSubmit={handleApplyFilter}
        className="panel form-panel reports-filter"
      >
        <label style={{ margin: 0 }}>
          Период с
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label style={{ margin: 0 }}>
          Период по
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <div className="reports-filter-actions">
          <button type="submit" className="primary" disabled={loading}>
            Применить
          </button>
          <button
            type="button"
            onClick={() => applyPreset(0)}
            disabled={loading}
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => applyPreset(6)}
            disabled={loading}
          >
            7 дней
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            disabled={loading}
          >
            Месяц
          </button>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetFilter}
              disabled={loading}
            >
              Сбросить
            </button>
          )}
        </div>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {loading && !data && <p className="loading">Загрузка отчёта…</p>}

      {data && (
        <div className="stat-grid">
          {cards.map(([label, value]) => (
            <article className="panel" key={label}>
              <small>{label}</small>
              <h2>{value}</h2>
            </article>
          ))}
        </div>
      )}

      <div className="panel" style={{ marginTop: '1.5rem' }}>
        <h2>CSV-экспорт</h2>
        <div className="actions">
          {['products', 'stock', 'sales', 'orders'].map((kind) => (
            <a
              className="button secondary"
              key={kind}
              href={`/api/shops/${shopId}/reports/export/${kind}.csv${
                (kind === 'sales' || kind === 'orders') && exportQs
                  ? '?' + exportQs
                  : ''
              }`}
            >
              {kind === 'products'
                ? 'Товары'
                : kind === 'stock'
                  ? 'Остатки'
                  : kind === 'sales'
                    ? 'Продажи'
                    : 'Заказы'}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
