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

type PeriodKey = 'today' | 'week' | 'month';

function isoDate(daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function periodRange(period: PeriodKey): { from: string; to: string } {
  const to = isoDate(0);
  if (period === 'today') return { from: to, to };
  if (period === 'week') return { from: isoDate(6), to };
  return { from: isoDate(29), to };
}

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

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('ru-KG', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

function ProductThumb({ variant }: { variant: Variant }) {
  const src = variant.photoUrls?.find(Boolean) || variant.photoUrl;
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

export function ShopHome() {
  const { shopId = '' } = useParams(),
    session = useSession();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  const canReports = hasShopPermission(shop, 'reports');
  const canCatalog = shop?.role === 'owner' || shop?.role === 'manager';
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsTotal, setVariantsTotal] = useState(0);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shop) return;
    let alive = true;
    setError('');
    const tasks: Promise<void>[] = [
      api<Page<Variant>>(`/shops/${shop.id}/variants?page=1&pageSize=48`).then(
        (page) => {
          if (!alive) return;
          const active = page.items.filter((v) => !v.archived);
          setVariants(active);
          setVariantsTotal(page.total || active.length);
        },
      ),
      api<Page<SaleSummary>>(`/shops/${shop.id}/pos/sales?page=1`).then(
        (page) => {
          if (!alive) return;
          setSales(page.items.slice(0, 5));
          setSalesTotal(page.total);
        },
      ),
    ];
    if (canReports) {
      const { from, to } = periodRange(period);
      const q = new URLSearchParams({ from, to });
      tasks.push(
        api<FinancialSummary>(
          `/shops/${shop.id}/reports/summary?${q.toString()}`,
        ).then((data) => {
          if (alive) setSummary(data);
        }),
      );
    } else {
      setSummary(null);
    }
    void Promise.all(tasks).catch((e) => {
      if (alive) setError(errorText(e));
    });
    return () => {
      alive = false;
    };
  }, [shop, canReports, period]);

  if (!shop) return null;

  const lowStockItems = variants
    .filter((v) => (v.available ?? 0) <= 5)
    .sort((a, b) => (a.available ?? 0) - (b.available ?? 0));
  const lowStockCount = summary?.lowStockCount ?? lowStockItems.length;
  const receiptsCount = canReports
    ? (summary?.posSalesCount ?? 0) + (summary?.onlineSalesCount ?? 0)
    : salesTotal;
  const series = summary?.dailySeries ?? [];
  const maxDayMinor = Math.max(
    1,
    ...series.map((point) => Math.max(point.netMinor, point.salesMinor, 0)),
  );
  const base = `/seller/${shop.id}`;

  return (
    <div className="shop-home">
      <header className="shop-home-header">
        <div>
          <h1>Главная</h1>
          <p className="muted">
            Добро пожаловать в MyStore! Обзор магазина «{shop.name}».
          </p>
        </div>
        {canReports && (
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
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <section className="shop-home-top">
        <div className="shop-home-banner">
          <div className="shop-home-banner-copy">
            <h2>Управляйте продажами, товарами и складом в одном месте</h2>
            <ul className="shop-home-banner-pills">
              <li>Касса и продажи</li>
              <li>Учёт склада</li>
              <li>Отчёты и аналитика</li>
            </ul>
          </div>
        </div>
        <div className="shop-home-actions" aria-label="Быстрые действия">
          <Link to={`${base}/pos`} className="shop-home-action primary">
            <strong>Открыть кассу</strong>
            <small>Продажа товаров</small>
          </Link>
          {canCatalog && (
            <Link to={`${base}/receiving`} className="shop-home-action">
              <strong>Новая приёмка</strong>
              <small>Поступление товара</small>
            </Link>
          )}
          {canCatalog && (
            <Link to={`${base}/products/new`} className="shop-home-action">
              <strong>Создать товар</strong>
              <small>Новая карточка</small>
            </Link>
          )}
          <Link to={`${base}/labels`} className="shop-home-action">
            <strong>Печать этикеток</strong>
            <small>Ценники и штрихкоды</small>
          </Link>
        </div>
      </section>

      <section className="shop-home-kpis" aria-label="Ключевые показатели">
        <article className="shop-home-kpi highlight">
          <span>
            {period === 'today' ? 'Продажи сегодня' : 'Продажи за период'}
          </span>
          <strong>
            {canReports
              ? formatSom(summary?.revenueMinor ?? 0)
              : 'По правам отчётов'}
          </strong>
        </article>
        <article className="shop-home-kpi">
          <span>Чеков</span>
          <strong>{receiptsCount}</strong>
        </article>
        <article className="shop-home-kpi">
          <span>Товаров</span>
          <strong>{variantsTotal}</strong>
        </article>
        <article
          className={
            lowStockCount > 0 ? 'shop-home-kpi warning' : 'shop-home-kpi'
          }
        >
          <span>Низкий остаток</span>
          <strong>{lowStockCount} шт.</strong>
        </article>
      </section>

      <div className="shop-home-grid">
        <section className="panel shop-home-card shop-home-chart-card">
          <div className="shop-home-card-head">
            <h2>Динамика продаж</h2>
            {canReports && (
              <Link to={`${base}/reports`} className="shop-home-link">
                Все отчёты →
              </Link>
            )}
          </div>
          {canReports ? (
            <div className="shop-home-chart-wrap">
              {series.length > 0 ? (
                <div className="shop-home-bars" role="list">
                  {series.slice(-7).map((point) => {
                    const value = Math.max(0, point.netMinor);
                    const pct = Math.max(
                      10,
                      Math.round((value / maxDayMinor) * 100),
                    );
                    return (
                      <div
                        className="shop-home-bar-col"
                        key={point.day}
                        role="listitem"
                      >
                        <div className="shop-home-bar-track">
                          <div
                            className="shop-home-bar-fill"
                            style={{ height: `${pct}%` }}
                            title={`${point.day}: ${formatSom(value)}`}
                          />
                        </div>
                        <small>{formatDayShort(point.day)}</small>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">За выбранный период продаж пока нет.</p>
              )}
              <div className="shop-home-chart-summary">
                <span>Итого за период</span>
                <strong>{formatSom(summary?.revenueMinor ?? 0)}</strong>
                <small>
                  Валовая прибыль: {formatSom(summary?.grossProfitMinor ?? 0)}
                </small>
              </div>
            </div>
          ) : (
            <p className="muted">
              Финансовая аналитика доступна владельцу и сотрудникам с правом
              просмотра отчётов.
            </p>
          )}
        </section>

        <section className="panel shop-home-card shop-home-low-stock-card">
          <div className="shop-home-card-head">
            <h2>Низкий остаток ({lowStockItems.length})</h2>
            <Link to={`${base}/products`} className="shop-home-link">
              Все товары →
            </Link>
          </div>
          {lowStockItems.length > 0 ? (
            <div className="shop-home-stock-list">
              {lowStockItems.slice(0, 5).map((item) => (
                <div className="shop-home-stock-row" key={item.id}>
                  <ProductThumb variant={item} />
                  <div className="shop-home-stock-meta">
                    <strong>{item.name}</strong>
                    <small>Арт. {item.barcode}</small>
                  </div>
                  <span className="shop-home-stock-pill">
                    {item.available ?? 0} шт.
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Все товары в достаточном количестве.</p>
          )}
        </section>

        <section className="panel shop-home-card shop-home-sales-card">
          <div className="shop-home-card-head">
            <h2>Последние продажи</h2>
            <Link to={`${base}/sales`} className="shop-home-link">
              Все продажи →
            </Link>
          </div>
          {sales.length > 0 ? (
            <div className="shop-home-sales-list">
              {sales.map((sale) => (
                <div className="shop-home-sale-row" key={sale.id}>
                  <span className="shop-home-sale-time">
                    {formatTime(sale.createdAt)}
                  </span>
                  <span className="shop-home-sale-id">
                    Чек #{sale.id.slice(0, 6)}
                  </span>
                  <span className="shop-home-sale-method">
                    {sale.method === 'card' ? 'Карта' : 'Наличные'}
                  </span>
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

        {canReports && (
          <section className="panel shop-home-card shop-home-reports-card">
            <div className="shop-home-card-head">
              <h2>Быстрые отчёты</h2>
            </div>
            <div className="shop-home-report-tiles">
              <Link to={`${base}/reports`} className="shop-home-report-tile">
                <strong>Продажи</strong>
                <small>Выручка и чеки</small>
              </Link>
              <Link to={`${base}/inventory`} className="shop-home-report-tile">
                <strong>Остатки</strong>
                <small>Склад и ревизия</small>
              </Link>
              {shop.role === 'owner' && (
                <Link to={`${base}/staff`} className="shop-home-report-tile">
                  <strong>Сотрудники</strong>
                  <small>Роли и доступы</small>
                </Link>
              )}
              <Link to={`${base}/reports`} className="shop-home-report-tile">
                <strong>Прибыль</strong>
                <small>Маржа и себестоимость</small>
              </Link>
            </div>
          </section>
        )}
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
