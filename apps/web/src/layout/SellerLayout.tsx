import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';
import {
  hasShopPermission,
  type FinancialSummary,
  type Page,
  type SaleSummary,
  type Variant,
} from '../api/types';
import { useSession } from '../auth/SessionProvider';
import WorkspaceShell from './WorkspaceShell';
import { comparisonTrend, dashboardPeriodRange, shopDate } from './dashboard-period';

type PeriodKey = 'today' | 'week' | 'month' | 'custom';


function formatDayShort(day: string) {
  try {
    const d = new Date(day + 'T00:00:00');
    return new Intl.DateTimeFormat('ru-KG', {
      weekday: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return day.slice(5);
  }
}

function niceCeil(n: number): number {
  if (n <= 10) return 10;
  if (n <= 50) return 50;
  const factor = Math.pow(10, Math.floor(Math.log10(n)));
  const d = n / factor;
  if (d <= 1) return 1 * factor;
  if (d <= 2) return 2 * factor;
  if (d <= 5) return 5 * factor;
  return 10 * factor;
}

function CoinsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16.7 13.5h.01" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20V10" />
      <path d="M18 20V4" />
      <path d="M6 20v-4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect width="12" height="8" x="6" y="14" />
    </svg>
  );
}

function WarningTriangleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ProductThumb({
  photoUrl,
  photoUrls,
}: {
  photoUrl?: string;
  photoUrls?: string[];
}) {
  const src = photoUrls?.find(Boolean) || photoUrl;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="shop-home-thumb" aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      )}
    </span>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  trendText: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  infoTooltip?: string;
}

function MetricCard({
  title,
  value,
  trendText,
  icon,
  iconBg,
  iconColor,
  infoTooltip,
}: MetricCardProps) {
  return (
    <article className="shop-home-kpi-card">
      <div className="shop-home-kpi-top">
        <span
          className="shop-home-kpi-icon-badge"
          style={{ background: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="shop-home-kpi-label">{title}</span>
        {infoTooltip && (
          <span
            className="shop-home-kpi-info"
            title={infoTooltip}
            aria-label={infoTooltip}
          >
            <InfoIcon />
          </span>
        )}
      </div>
      <strong className="shop-home-kpi-value">{value}</strong>
      <div className="shop-home-kpi-trend">
        <span className="shop-home-kpi-trend-pill">{trendText}</span>
      </div>
    </article>
  );
}

function generateBezierPath(coords: { x: number; y: number }[]): string {
  if (coords.length < 2) return '';
  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const dx = (p1.x - p0.x) * 0.45;
    const cp1x = p0.x + dx;
    const cp1y = p0.y;
    const cp2x = p1.x - dx;
    const cp2y = p1.y;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return path;
}

export function ShopHome() {
  const { shopId = '' } = useParams();
  const session = useSession();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  const canReports = hasShopPermission(shop, 'reports');
  const canCatalog = shop?.role === 'owner' || shop?.role === 'manager';

  const [period, setPeriod] = useState<PeriodKey>('today');
  const [refreshTick, setRefreshTick] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customFrom, setCustomFrom] = useState(shopDate(new Date(), 7));
  const [customTo, setCustomTo] = useState(shopDate());

  const [chartMetric, setChartMetric] = useState<'revenue' | 'sales'>(
    'revenue',
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<FinancialSummary | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [lowStock, setLowStock] = useState<Variant[]>([]);

  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shop) return;
    let alive = true;
    setError('');
    setSummary(null);
    setPreviousSummary(null);
    setLowStock([]);

    const tasks: Promise<unknown>[] = [
      Promise.all([
        api<Page<Variant>>(`/shops/${shop.id}/variants?page=1&pageSize=10&stock=out`),
        api<Page<Variant>>(`/shops/${shop.id}/variants?page=1&pageSize=10&stock=low`),
      ]).then(([empty, low]) => {
        if (alive) {
          setLowStock(
            [...empty.items, ...low.items]
              .filter((item) => !item.archived)
              .sort((a, b) => (a.available ?? 0) - (b.available ?? 0)),
          );
        }
      }),
      api<Page<Variant>>(`/shops/${shop.id}/variants?page=1&pageSize=100`).then(
        (page) => {
          if (!alive) return;
          const active = page.items.filter((v) => !v.archived);
          setVariants(active);
        },
      ),
      api<Page<SaleSummary>>(`/shops/${shop.id}/pos/sales?page=1&sort=newest`).then(
        (page) => {
          if (!alive) return;
          setSales(page.items.slice(0, 5));
          setSalesTotal(page.total);
        },
      ),
    ];

    if (canReports) {
      try {
        const range = dashboardPeriodRange(period, customFrom, customTo);
        const q = new URLSearchParams({ from: range.from, to: range.to });
        const previous = new URLSearchParams({
          from: range.previousFrom,
          to: range.previousTo,
        });
        tasks.push(
          api<FinancialSummary>(
            `/shops/${shop.id}/reports/summary?${q.toString()}`,
          ).then((data) => {
            if (alive) setSummary(data);
          }),
          api<FinancialSummary>(
            `/shops/${shop.id}/reports/summary?${previous.toString()}`,
          ).then((data) => {
            if (alive) setPreviousSummary(data);
          }),
        );
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Неверный диапазон дат');
      }
    }

    void Promise.allSettled(tasks).then((results) => {
      if (!alive) return;
      const failure = results.find((result) => result.status === 'rejected');
      if (failure?.status === 'rejected') setError(errorText(failure.reason));
    });

    return () => {
      alive = false;
    };
  }, [shop, canReports, period, customFrom, customTo, refreshTick]);

  if (!shop) return null;

  const lowStockItems = lowStock;

  const receiptsCount = canReports
    ? (summary?.posSalesCount ?? 0) + (summary?.onlineSalesCount ?? 0)
    : salesTotal;
  const previousReceiptsCount =
    (previousSummary?.posSalesCount ?? 0) +
    (previousSummary?.onlineSalesCount ?? 0);

  const base = `/seller/${shop.id}`;

  const averageCheckMinor =
    receiptsCount > 0 && summary?.revenueMinor
      ? Math.round(summary.revenueMinor / receiptsCount)
      : 0;

  // Chart data calculation
  const series = summary?.dailySeries ?? [];
  let chartPoints: { label: string; val: number; tooltipVal: string }[] = [];

  if (summary && period === 'today') {
    const hours = summary.hourlySeries ?? [];
    chartPoints = Array.from({ length: 24 }, (_, hour) => {
      const point = hours.find((row) => row.hour === hour);
      const net = point?.netMinor ?? 0;
      const count = point?.salesCount ?? 0;
      return {
        label: `${String(hour).padStart(2, '0')}:00`,
        val: chartMetric === 'revenue' ? net / 100 : count,
        tooltipVal:
          chartMetric === 'revenue' ? formatSom(net) : `${count} шт.`,
      };
    });
  } else if (summary && series.length > 0) {
    chartPoints = series.map((pt) => ({
      label: formatDayShort(pt.day),
      val: chartMetric === 'revenue' ? pt.netMinor / 100 : pt.salesCount,
      tooltipVal:
        chartMetric === 'revenue'
          ? formatSom(pt.netMinor)
          : `${pt.salesCount} шт.`,
    }));
  }

  // Chart coordinate geometry
  const maxRaw = Math.max(
    ...chartPoints.map((p) => p.val),
    0,
  );
  const niceMax = niceCeil(maxRaw);
  const xMin = 50;
  const xMax = 580;
  const yMin = 40;
  const yMax = 180;

  const coords = chartPoints.map((p, i) => {
    const x =
      chartPoints.length > 1
        ? xMin + (i / (chartPoints.length - 1)) * (xMax - xMin)
        : (xMin + xMax) / 2;
    const y = yMin + (1 - p.val / niceMax) * (yMax - yMin);
    return { x, y, val: p.val };
  });

  const curvePath = generateBezierPath(coords);
  const areaPath =
    coords.length > 0
      ? `${curvePath} L ${coords[coords.length - 1].x} ${yMax} L ${coords[0].x} ${yMax} Z`
      : '';

  const activeIndex =
    hoverIndex !== null
      ? hoverIndex
      : Math.max(
          0,
          coords.reduce(
            (maxI, pt, i) => (pt.val > coords[maxI].val ? i : maxI),
            0,
          ),
        );
  const activeCoord = coords[activeIndex];
  const activePoint = chartPoints[activeIndex];

  const yGridLevels = [
    niceMax,
    niceMax * 0.75,
    niceMax * 0.5,
    niceMax * 0.25,
    0,
  ];

  // Top products
  const topProductsList = summary?.topProducts?.slice(0, 3) ?? [];

  const variantMap = new Map(variants.map((v) => [v.id, v]));

  return (
    <div className="shop-home">
      {/* Header */}
      <header className="shop-home-header">
        <div className="shop-home-heading-group">
          <h1>Главная</h1>
          <p className="shop-home-subtitle">
            Обзор продаж и состояния магазина
          </p>
        </div>

        {canReports && (
          <div className="shop-home-controls">
            <div
              className="shop-home-periods"
              role="group"
              aria-label="Период обзора"
            >
              {(
                [
                  ['today', 'Сегодня'],
                  ['week', '7 дней'],
                  ['month', 'Месяц'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    period === key
                      ? 'shop-home-period active'
                      : 'shop-home-period'
                  }
                  aria-pressed={period === key}
                  onClick={() => {
                    setPeriod(key);
                    setRefreshTick((t) => t + 1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="shop-home-date-picker-wrap">
              <button
                type="button"
                className={`shop-home-date-btn ${period === 'custom' ? 'active' : ''}`}
                onClick={() => setShowDatePicker((v) => !v)}
                aria-expanded={showDatePicker}
              >
                <span aria-hidden="true">📅</span> Диапазон дат ▾
              </button>

              {showDatePicker && (
                <div
                  className="shop-home-date-popover"
                  role="dialog"
                  aria-label="Выбор диапазона дат"
                >
                  <div className="shop-home-date-inputs">
                    <label>
                      <span>С:</span>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </label>
                    <label>
                      <span>По:</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn-primary shop-home-date-apply"
                    onClick={() => {
                      setPeriod('custom');
                      setShowDatePicker(false);
                      setRefreshTick((t) => t + 1);
                    }}
                  >
                    Применить
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {/* Row 1: 4 KPI Metric Cards */}
      <section className="shop-home-kpis-grid" aria-label="Ключевые показатели">
        <MetricCard
          title="Выручка"
          value={
            canReports
              ? summary ? formatSom(summary.revenueMinor) : '—'
              : 'По правам отчётов'
          }
          trendText={comparisonTrend(summary?.revenueMinor, previousSummary?.revenueMinor, period)}
          icon={<CoinsIcon />}
          iconBg="#e8f5ee"
          iconColor="#176b4a"
          infoTooltip="Общая сумма продаж с учётом возвратов"
        />
        <MetricCard
          title="Прибыль"
          value={
            canReports
              ? summary ? formatSom(summary.grossProfitMinor) : '—'
              : 'По правам отчётов'
          }
          trendText={comparisonTrend(summary?.grossProfitMinor, previousSummary?.grossProfitMinor, period)}
          icon={<BarChartIcon />}
          iconBg="#e8f5ee"
          iconColor="#176b4a"
          infoTooltip="Валовая прибыль: выручка минус себестоимость"
        />
        <MetricCard
          title="Продажи"
          value={canReports && !summary ? '—' : String(receiptsCount)}
          trendText={comparisonTrend(summary ? receiptsCount : undefined, previousSummary ? previousReceiptsCount : undefined, period)}
          icon={<CartIcon />}
          iconBg="#e0f2fe"
          iconColor="#0284c7"
          infoTooltip="Количество проведённых продаж (чеков)"
        />
        <MetricCard
          title="Средний чек"
          value={canReports ? summary ? formatSom(averageCheckMinor) : '—' : 'По правам отчётов'}
          trendText={comparisonTrend(summary ? averageCheckMinor : undefined, previousSummary && previousReceiptsCount > 0 ? Math.round(previousSummary.revenueMinor / previousReceiptsCount) : previousSummary ? 0 : undefined, period)}
          icon={<ReceiptIcon />}
          iconBg="#fef3c7"
          iconColor="#d97706"
          infoTooltip="Средняя сумма одной покупки"
        />
      </section>

      {/* Row 2: Middle Section (Dynamics Chart + Recent Sales) */}
      <div className="shop-home-middle-grid">
        {/* Left Column: Dynamics Area Chart */}
        <section className="shop-home-card shop-home-dynamics-card">
          <div className="shop-home-card-header">
            <h2>
              {chartMetric === 'revenue'
                ? 'Динамика выручки'
                : 'Динамика продаж'}
            </h2>
            <div
              className="shop-home-chart-toggle"
              role="group"
              aria-label="Метрика графика"
            >
              <button
                type="button"
                className={chartMetric === 'revenue' ? 'active' : ''}
                onClick={() => setChartMetric('revenue')}
              >
                Выручка
              </button>
              <button
                type="button"
                className={chartMetric === 'sales' ? 'active' : ''}
                onClick={() => setChartMetric('sales')}
              >
                Продажи
              </button>
            </div>
          </div>

          {canReports && summary ? (
            chartPoints.length ? <div className="shop-home-svg-chart-container">
              <svg
                viewBox="0 0 600 210"
                className="shop-home-svg-chart"
                preserveAspectRatio="none"
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient
                    id="revenueAreaGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#176b4a" stopOpacity="0.25" />
                    <stop
                      offset="100%"
                      stopColor="#176b4a"
                      stopOpacity="0.01"
                    />
                  </linearGradient>
                  <filter
                    id="tooltipShadow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="2"
                      stdDeviation="3"
                      floodColor="#000"
                      floodOpacity="0.08"
                    />
                  </filter>
                </defs>

                {/* Y-axis gridlines & labels */}
                {yGridLevels.map((lvl, idx) => {
                  const y = yMin + (1 - lvl / niceMax) * (yMax - yMin);
                  const label =
                    chartMetric === 'revenue'
                      ? lvl >= 1000
                        ? `${Math.round(lvl / 1000)}k`
                        : `${lvl}`
                      : `${lvl}`;
                  return (
                    <g key={idx}>
                      <line
                        x1={xMin}
                        y1={y}
                        x2={xMax}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={xMin - 8}
                        y={y + 4}
                        textAnchor="end"
                        fill="#9ca3af"
                        fontSize="11"
                        fontFamily="inherit"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Filled Area */}
                {areaPath && <path d={areaPath} fill="url(#revenueAreaGrad)" />}

                {/* Curved Line */}
                {curvePath && (
                  <path
                    d={curvePath}
                    fill="none"
                    stroke="#176b4a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover trigger areas */}
                {coords.map((c, i) => (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r="14"
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverIndex(i)}
                  />
                ))}

                {/* X-axis labels */}
                {coords.map((c, i) => (
                  <text
                    key={i}
                    x={c.x}
                    y={yMax + 18}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize="11"
                    fontFamily="inherit"
                  >
                    {period === 'today' && i % 3 !== 0 ? '' : chartPoints[i]?.label}
                  </text>
                ))}

                {/* Active Indicator & Tooltip */}
                {activeCoord && activePoint && (
                  <g className="shop-home-chart-active-marker">
                    <circle
                      cx={activeCoord.x}
                      cy={activeCoord.y}
                      r="5.5"
                      fill="#176b4a"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <g
                      transform={`translate(${activeCoord.x}, ${Math.max(
                        20,
                        activeCoord.y - 38,
                      )})`}
                      filter="url(#tooltipShadow)"
                    >
                      <rect
                        x="-44"
                        y="-10"
                        width="88"
                        height="32"
                        rx="7"
                        fill="#ffffff"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#6b7280"
                        fontSize="10"
                        fontWeight="500"
                      >
                        {activePoint.label}
                      </text>
                      <text
                        x="0"
                        y="16"
                        textAnchor="middle"
                        fill="#111827"
                        fontSize="11.5"
                        fontWeight="700"
                      >
                        {activePoint.tooltipVal}
                      </text>
                    </g>
                  </g>
                )}
              </svg>
            </div> : <p className="muted">За выбранный период продаж нет.</p>
          ) : (
            <p className="muted">
              {canReports ? 'Нет данных для отображения. Проверьте подключение и период.' : 'Финансовая аналитика доступна владельцу и сотрудникам с правом просмотра отчётов.'}
            </p>
          )}
        </section>

        {/* Right Column: Recent Sales */}
        <section className="shop-home-card shop-home-sales-card">
          <div className="shop-home-card-header">
            <h2>Последние продажи</h2>
            <Link to={`${base}/sales`} className="shop-home-link">
              Смотреть все →
            </Link>
          </div>

          {sales.length > 0 ? (
            <div className="shop-home-list">
              {sales.map((sale) => (
                <div className="shop-home-recent-sale-row" key={sale.id}>
                  <span className="shop-home-sale-time">
                    {new Date(sale.createdAt).toLocaleString('ru-KG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="shop-home-sale-icon" aria-hidden="true">
                    <ReceiptIcon />
                  </div>
                  <div className="shop-home-sale-meta">
                    <strong>Чек #{sale.id.slice(0, 6)}</strong>
                    <small>
                      {sale.method === 'card' ? 'Оплата картой' : sale.method === 'cash' ? 'Наличные' : 'Без записи оплаты'}
                    </small>
                  </div>
                  <strong className="shop-home-sale-sum">
                    {formatSom(sale.totalMinor)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Продаж пока не было.</p>
          )}
        </section>
      </div>

      {/* Row 3: Bottom Section (3 Columns: Top Products, Low Stock, Quick Actions) */}
      <div className="shop-home-bottom-grid">
        {/* Column 1: Top Products */}
        <section className="shop-home-card">
          <div className="shop-home-card-header">
            <h2>
              {period === 'today' ? 'Топ товаров за сегодня' : 'Топ товаров'}
            </h2>
            <Link to={`${base}/products`} className="shop-home-link">
              Смотреть все →
            </Link>
          </div>

          {topProductsList.length > 0 ? (
            <div className="shop-home-list">
              {topProductsList.map((item, idx) => {
                const variant = variantMap.get(item.id);
                return (
                  <div className="shop-home-top-product-row" key={item.id}>
                    <span className="shop-home-rank-badge">{idx + 1}</span>
                    <ProductThumb
                      photoUrl={variant?.photoUrls?.[0] || variant?.photoUrl}
                      photoUrls={variant?.photoUrls}
                    />
                    <div className="shop-home-product-meta">
                      <strong>{item.name}</strong>
                      <small>
                        {item.quantitySold > 0
                          ? `Продано: ${item.quantitySold} шт.`
                          : `В наличии: ${variant?.available ?? 0} шт.`}
                      </small>
                    </div>
                    <strong className="shop-home-product-sum">
                      {formatSom(item.revenueMinor)}
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">За выбранный период продаж товаров нет.</p>
          )}
        </section>

        {/* Column 2: Low Stock Alerts */}
        <section className="shop-home-card">
          <div className="shop-home-card-header">
            <h2>Остатки на складе</h2>
            <Link to={`${base}/inventory`} className="shop-home-link">
              Смотреть все →
            </Link>
          </div>

          {lowStockItems.length > 0 ? (
            <div className="shop-home-list">
              {lowStockItems.slice(0, 4).map((item) => (
                <div className="shop-home-stock-alert-row" key={item.id}>
                  <span className="shop-home-alert-icon" aria-hidden="true">
                    <WarningTriangleIcon />
                  </span>
                  <div className="shop-home-product-meta">
                    <strong>{item.name}</strong>
                    <small className="shop-home-stock-warning-text">
                      Остаток: {item.available ?? 0} шт.
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Все товары в достаточном количестве.</p>
          )}
        </section>

        {/* Column 3: Quick Actions */}
        <section className="shop-home-card">
          <div className="shop-home-card-header">
            <h2>Быстрые действия</h2>
          </div>

          <div className="shop-home-actions-tile-grid">
            <Link
              to={`${base}/pos`}
              className="shop-home-action-tile"
              aria-label="Открыть кассу"
            >
              <span
                className="shop-home-action-tile-icon green"
                aria-hidden="true"
              >
                <CartIcon />
              </span>
              <span className="shop-home-action-tile-title">Новая продажа</span>
            </Link>

            {canCatalog && (
              <Link
                to={`${base}/products/new`}
                className="shop-home-action-tile"
                aria-label="Создать товар"
              >
                <span
                  className="shop-home-action-tile-icon green"
                  aria-hidden="true"
                >
                  <PlusSquareIcon />
                </span>
                <span className="shop-home-action-tile-title">
                  Создать товар
                </span>
              </Link>
            )}

            {canCatalog && (
              <Link
                to={`${base}/receiving`}
                className="shop-home-action-tile"
                aria-label="Новая приёмка"
              >
                <span
                  className="shop-home-action-tile-icon green"
                  aria-hidden="true"
                >
                  <InboxIcon />
                </span>
                <span className="shop-home-action-tile-title">
                  Приёмка товара
                </span>
              </Link>
            )}

            <Link
              to={`${base}/labels`}
              className="shop-home-action-tile"
              aria-label="Печать этикеток"
            >
              <span
                className="shop-home-action-tile-icon green"
                aria-hidden="true"
              >
                <PrinterIcon />
              </span>
              <span className="shop-home-action-tile-title">
                Печать этикеток
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SellerLayout() {
  return (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  );
}
