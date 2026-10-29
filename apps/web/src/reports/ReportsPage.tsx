import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { FinancialSummary } from '../api/types';

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KGS',
  }).format(n / 100);

function DonutChart({
  title,
  primaryLabel,
  primaryMinor,
  primaryColor,
  secondaryLabel,
  secondaryMinor,
  secondaryColor,
}: {
  title: string;
  primaryLabel: string;
  primaryMinor: number;
  primaryColor: string;
  secondaryLabel: string;
  secondaryMinor: number;
  secondaryColor: string;
}) {
  const total = Math.max(0, primaryMinor) + Math.max(0, secondaryMinor);
  const primaryPct = total > 0 ? Math.round((primaryMinor / total) * 100) : 0;
  const secondaryPct = total > 0 ? 100 - primaryPct : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const primaryDash = total > 0 ? (primaryMinor / total) * circumference : 0;

  return (
    <div className="analytics-donut-block">
      <h3>{title}</h3>
      <div className="analytics-donut-row">
        <svg
          width="116"
          height="116"
          viewBox="0 0 116 116"
          aria-label={title}
          role="img"
        >
          <circle
            cx="58"
            cy="58"
            r={radius}
            fill="none"
            stroke={total > 0 ? secondaryColor : '#e6ecea'}
            strokeWidth="14"
          />
          {total > 0 && primaryDash > 0 && (
            <circle
              cx="58"
              cy="58"
              r={radius}
              fill="none"
              stroke={primaryColor}
              strokeWidth="14"
              strokeDasharray={`${primaryDash} ${circumference}`}
              transform="rotate(-90 58 58)"
              strokeLinecap="butt"
            />
          )}
          <text
            x="58"
            y="55"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fill="#18322c"
          >
            {total > 0 ? `${primaryPct}%` : '0%'}
          </text>
          <text x="58" y="71" textAnchor="middle" fontSize="10" fill="#64748b">
            {primaryLabel}
          </text>
        </svg>
        <div className="analytics-legend">
          <div className="analytics-legend-item">
            <span
              className="analytics-dot"
              style={{ background: primaryColor }}
            />
            <div>
              <strong>
                {primaryLabel} ({primaryPct}%)
              </strong>
              <small className="muted">{money(primaryMinor)}</small>
            </div>
          </div>
          <div className="analytics-legend-item">
            <span
              className="analytics-dot"
              style={{ background: secondaryColor }}
            />
            <div>
              <strong>
                {secondaryLabel} ({secondaryPct}%)
              </strong>
              <small className="muted">{money(secondaryMinor)}</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <>
          <div className="analytics-grid" aria-label="Визуальная аналитика">
            <section className="panel analytics-card">
              <div className="analytics-card-head">
                <div>
                  <p className="eyebrow">Динамика за период</p>
                  <h2>Продажи и возвраты по дням</h2>
                </div>
                <div className="analytics-inline-legend">
                  <span>
                    <i
                      className="analytics-dot"
                      style={{ background: '#176854' }}
                    />
                    Продажи
                  </span>
                  <span>
                    <i
                      className="analytics-dot"
                      style={{ background: '#e11d48' }}
                    />
                    Возвраты
                  </span>
                </div>
              </div>
              {(() => {
                const series =
                  data.dailySeries && data.dailySeries.length > 0
                    ? data.dailySeries
                    : [
                        {
                          day: 'Итого',
                          salesMinor: data.salesMinor,
                          returnsMinor: data.returnsMinor,
                          netMinor: data.revenueMinor,
                          salesCount:
                            (data.posSalesCount ?? 0) +
                            (data.onlineSalesCount ?? 0),
                        },
                      ];
                const maxVal = Math.max(
                  1,
                  ...series.map((d) => Math.max(d.salesMinor, d.returnsMinor)),
                );
                return (
                  <div className="analytics-daily-chart">
                    {series.map((d) => {
                      const saleH = Math.max(
                        4,
                        Math.round((d.salesMinor / maxVal) * 140),
                      );
                      const retH =
                        d.returnsMinor > 0
                          ? Math.max(
                              4,
                              Math.round((d.returnsMinor / maxVal) * 140),
                            )
                          : 0;
                      const label =
                        d.day.length === 10
                          ? `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}`
                          : d.day;
                      return (
                        <div className="analytics-day-col" key={d.day}>
                          <div
                            className="analytics-day-bars"
                            title={`${d.day}: продажи ${money(d.salesMinor)}, возвраты ${money(d.returnsMinor)}`}
                          >
                            <span
                              className="analytics-bar-sale"
                              style={{ height: `${saleH}px` }}
                            />
                            {retH > 0 && (
                              <span
                                className="analytics-bar-return"
                                style={{ height: `${retH}px` }}
                              />
                            )}
                          </div>
                          <small>{label}</small>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </section>

            <section className="panel analytics-card">
              <div className="analytics-card-head">
                <div>
                  <p className="eyebrow">Распределение потоков</p>
                  <h2>Каналы продаж и оплата</h2>
                </div>
              </div>
              <div className="analytics-donuts-wrap">
                <DonutChart
                  title="Каналы продаж"
                  primaryLabel="Касса (POS)"
                  primaryMinor={data.posSalesMinor ?? 0}
                  primaryColor="#176854"
                  secondaryLabel="Онлайн"
                  secondaryMinor={data.onlineSalesMinor ?? 0}
                  secondaryColor="#0ea5e9"
                />
                <DonutChart
                  title="Способы оплаты"
                  primaryLabel="Наличные"
                  primaryMinor={data.cashReceivedMinor}
                  primaryColor="#10b981"
                  secondaryLabel="Карта"
                  secondaryMinor={data.cardReceivedMinor}
                  secondaryColor="#6366f1"
                />
              </div>
            </section>

            <section className="panel analytics-card">
              <div className="analytics-card-head">
                <div>
                  <p className="eyebrow">Эффективность</p>
                  <h2>Структура выручки и маржинальность</h2>
                </div>
              </div>
              {(() => {
                const gross = Math.max(0, data.salesMinor);
                const profit = Math.max(0, data.grossProfitMinor);
                const cost = Math.max(0, data.costOfGoodsMinor);
                const ret = Math.max(0, data.returnsMinor);
                const denom = Math.max(1, profit + cost + ret);
                const profitPct =
                  data.revenueMinor > 0
                    ? Math.round(
                        (data.grossProfitMinor / data.revenueMinor) * 100,
                      )
                    : 0;
                const totalChecks =
                  (data.posSalesCount ?? 0) + (data.onlineSalesCount ?? 0);
                const avgCheckMinor =
                  totalChecks > 0 ? Math.round(gross / totalChecks) : 0;
                const returnRatePct =
                  gross > 0 ? Math.round((ret / gross) * 100) : 0;

                return (
                  <div className="analytics-margin-stack">
                    <div className="analytics-kpi-pills">
                      <div className="analytics-kpi-pill">
                        <span>Маржинальность</span>
                        <strong>{profitPct}%</strong>
                      </div>
                      <div className="analytics-kpi-pill">
                        <span>Средний чек</span>
                        <strong>{money(avgCheckMinor)}</strong>
                      </div>
                      <div className="analytics-kpi-pill">
                        <span>Доля возвратов</span>
                        <strong>{returnRatePct}%</strong>
                      </div>
                    </div>
                    <div
                      className="analytics-stacked-bar"
                      role="img"
                      aria-label="Структура валовых продаж"
                    >
                      <span
                        style={{
                          width: `${(profit / denom) * 100}%`,
                          background: '#176854',
                        }}
                        title={`Валовая прибыль: ${money(data.grossProfitMinor)}`}
                      />
                      <span
                        style={{
                          width: `${(cost / denom) * 100}%`,
                          background: '#3b82f6',
                        }}
                        title={`Себестоимость: ${money(data.costOfGoodsMinor)}`}
                      />
                      <span
                        style={{
                          width: `${(ret / denom) * 100}%`,
                          background: '#e11d48',
                        }}
                        title={`Возвраты: ${money(data.returnsMinor)}`}
                      />
                    </div>
                    <div className="analytics-inline-legend">
                      <span>
                        <i
                          className="analytics-dot"
                          style={{ background: '#176854' }}
                        />
                        Валовая прибыль: {money(data.grossProfitMinor)}
                      </span>
                      <span>
                        <i
                          className="analytics-dot"
                          style={{ background: '#3b82f6' }}
                        />
                        Себестоимость: {money(data.costOfGoodsMinor)}
                      </span>
                      <span>
                        <i
                          className="analytics-dot"
                          style={{ background: '#e11d48' }}
                        />
                        Возвраты: {money(data.returnsMinor)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </section>

            <section className="panel analytics-card">
              <div className="analytics-card-head">
                <div>
                  <p className="eyebrow">Товарная аналитика</p>
                  <h2>Топ товаров и категорий по выручке</h2>
                </div>
              </div>
              {data.topProducts && data.topProducts.length > 0 ? (
                <div className="admin-kit-category-bars">
                  {(() => {
                    const maxRev = Math.max(
                      1,
                      ...data.topProducts.map((p) => p.revenueMinor),
                    );
                    return data.topProducts.map((p) => (
                      <div key={p.id}>
                        <span>
                          <strong>
                            {p.name} ({p.quantitySold} шт.)
                          </strong>
                          <small>
                            {money(p.revenueMinor)} · прибыль{' '}
                            {money(p.profitMinor)}
                          </small>
                        </span>
                        <div>
                          <span
                            style={{
                              width: `${Math.max(4, Math.round((p.revenueMinor / maxRev) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="admin-kit-category-bars">
                  <div>
                    <span>
                      <strong>Товарный запас на складе</strong>
                      <small>
                        {data.physicalUnits - data.reservedUnits} шт. доступно ·{' '}
                        {data.reservedUnits} шт. в резерве
                      </small>
                    </span>
                    <div>
                      <span
                        style={{
                          width: `${
                            data.physicalUnits > 0
                              ? Math.max(
                                  6,
                                  Math.round(
                                    ((data.physicalUnits - data.reservedUnits) /
                                      data.physicalUnits) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                    Рейтинг товаров по выручке заполняется по мере проведения
                    продаж в выбранном периоде.
                  </p>
                </div>
              )}
              {data.categoryShare && data.categoryShare.length > 0 && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '14px',
                    borderTop: '1px solid #e6ecea',
                  }}
                >
                  <small
                    className="eyebrow"
                    style={{ display: 'block', marginBottom: '10px' }}
                  >
                    Выручка по категориям
                  </small>
                  <div className="actions">
                    {data.categoryShare.map((c) => (
                      <span className="badge" key={c.category}>
                        {c.category}: <strong>{money(c.revenueMinor)}</strong> (
                        {c.quantitySold} шт.)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="stat-grid">
            {cards.map(([label, value]) => (
              <article className="panel" key={label}>
                <small>{label}</small>
                <h2>{value}</h2>
              </article>
            ))}
          </div>
        </>
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
