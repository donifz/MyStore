import { ShopSelect } from './SellerLayout';
import {
  AdminBrand,
  AdminCard,
  AdminMetric,
  AdminIdentity,
} from '../platform/AdminKit';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';
import { useSession } from '../auth/SessionProvider';

type Summary = {
  revenueMinor: number;
  physicalUnits: number;
  openOrders: number;
  closedShifts: number;
};
type StoreSummary = {
  id: string;
  revenueMinor: number;
  physicalUnits: number;
  openOrders: number;
  closedShifts: number;
};
export default function PartnerDashboard() {
  const session = useSession();
  const shops =
    session.user?.shops.filter((shop) => shop.role === 'owner') ?? [];
  const [selectedShop, setSelectedShop] = useState('');
  const activeShop = shops.find((shop) => shop.id === selectedShop) ?? shops[0];
  const [summaries, setSummaries] = useState<StoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session.user || !shops.length) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all(
      shops.map(async (shop) => {
        const data = await api<Summary>(`/shops/${shop.id}/reports/summary`);
        return { id: shop.id, ...data };
      }),
    )
      .then((rows) => {
        if (active) {
          setSummaries(rows);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.user?.userId]);

  if (session.loading) return <p className="loading">Загрузка…</p>;
  if (!session.user) return <Navigate to="/seller/login" replace />;
  if (!shops.length) return <ShopSelect />;

  const total = (key: keyof Omit<StoreSummary, 'id'>) =>
    summaries.reduce((sum, row) => sum + row[key], 0);

  return (
    <div className="partner-shell admin-kit-shell">
      <aside className="partner-sidebar admin-kit-sidebar">
        <AdminBrand to="/seller" subtitle="Панель партнёра" />
        <nav aria-label="Разделы партнёра">
          <Link className="active" to="/seller">
            Обзор
          </Link>
          <a href="#partner-shops">Мои магазины</a>
          <Link to={`/seller/${activeShop.id}/products`}>Товары и остатки</Link>
          <Link to={`/seller/${activeShop.id}/sales`}>Продажи и смены</Link>
          {session.user.platformAdmin && (
            <Link to="/platform/admin">Администрирование</Link>
          )}
        </nav>
        <div className="admin-kit-sidebar-bottom">
          <span>{session.user.email}</span>
          <button
            onClick={() =>
              void session.logout().catch((e) => setError(errorText(e)))
            }
          >
            Выйти
          </button>
        </div>
      </aside>
      <div className="partner-main admin-kit-main">
        <header className="partner-topbar admin-kit-topbar">
          <span>MyStore / Обзор</span>
          {shops.length > 1 && (
            <label className="partner-shop-select">
              Магазин для переходов
              <select
                value={activeShop.id}
                onChange={(e) => setSelectedShop(e.target.value)}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <AdminIdentity email={session.user.email} role="Партнёр" />
        </header>
        <main className="partner-content admin-kit-content">
          <div className="partner-heading admin-kit-heading">
            <div>
              <h1>Панель партнёра MyStore</h1>
              <p className="muted">
                Только ваши магазины, товары, продажи и смены
              </p>
            </div>
            <span className="partner-access">Доступ к своим магазинам</span>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-kit-metrics">
            <AdminMetric symbol="▣" label="Мои магазины" value={shops.length} />
            <AdminMetric
              symbol="◈"
              label="Единиц товара на складе"
              value={loading ? '…' : error ? '—' : total('physicalUnits')}
            />
            <AdminMetric
              symbol="↗"
              tone="blue"
              label="Выручка (за всё время)"
              value={
                loading ? '…' : error ? '—' : formatSom(total('revenueMinor'))
              }
            />
            <AdminMetric
              symbol="▤"
              tone="amber"
              label="Открытые заказы"
              value={loading ? '…' : error ? '—' : total('openOrders')}
            />
          </div>
          <div id="partner-shops">
            <AdminCard
              title="Мои магазины"
              subtitle="Управление кассой, товарами и остатками"
              className="partner-stores"
            >
              <div className="table-wrap">
                <table className="admin-kit-table">
                  <thead>
                    <tr>
                      <th>Магазин</th>
                      <th>Остатки, шт.</th>
                      <th>Выручка</th>
                      <th>Заказы</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shops.map((shop) => {
                      const row = summaries.find((item) => item.id === shop.id);
                      const base = `/seller/${shop.id}`;
                      return (
                        <tr key={shop.id}>
                          <td>
                            <strong>{shop.name}</strong>
                          </td>
                          <td>{row?.physicalUnits ?? '—'}</td>
                          <td>{row ? formatSom(row.revenueMinor) : '—'}</td>
                          <td>{row?.openOrders ?? '—'}</td>
                          <td>
                            <div className="partner-links">
                              <Link to={base + '/pos'}>Касса</Link>
                              <Link to={base + '/products'}>Товары</Link>
                              <Link to={base + '/sales'}>Продажи</Link>
                              <Link to={base + '/shift'}>Смена</Link>
                              <Link to={base + '/reports'}>Отчёт</Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          </div>
          <p className="muted">
            Показатели суммируются только по вашим магазинам. Модерация чужих
            магазинов и управление платформой недоступны партнёрам.
          </p>
        </main>
      </div>
    </div>
  );
}
