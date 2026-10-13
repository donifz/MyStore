import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';
import { useSession } from '../auth/SessionProvider';
import { AdminCard, AdminMetric } from '../platform/AdminKit';
import { shopStart } from './workspace-navigation';
type Summary = {
  revenueMinor: number;
  physicalUnits: number;
  openOrders: number;
  closedShifts: number;
};
type StoreSummary = Summary & { id: string };
export default function PartnerDashboard() {
  const session = useSession(),
    shops = session.user?.shops ?? [];
  const owners = shops.filter((s) => s.role === 'owner'),
    ownerIds = owners.map((s) => s.id).join(',');
  const [summaries, setSummaries] = useState<StoreSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setSummaries([]);
    setError('');
    setLoading(owners.length > 0);
    if (!owners.length) return;
    Promise.all(
      owners.map(async (shop) => ({
        id: shop.id,
        ...(await api<Summary>(`/shops/${shop.id}/reports/summary`)),
      })),
    )
      .then((rows) => {
        if (active) setSummaries(rows);
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
  }, [session.user?.userId, ownerIds]);
  if (!shops.length)
    return (
      <>
        <div className="admin-kit-heading">
          <h1>Рабочий кабинет</h1>
        </div>
        <p className="panel">Доступ к магазину пока не выдан.</p>
      </>
    );
  const total = (key: keyof Summary) =>
    summaries.reduce((sum, row) => sum + row[key], 0);
  return (
    <>
      <div className="admin-kit-heading">
        <div>
          <h1>Мои магазины</h1>
          <p>Выберите магазин. Полномочия относятся к выбранному магазину.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {owners.length > 0 && (
        <>
          <p className="muted">Показатели только собственных магазинов</p>
          <div className="admin-kit-metrics">
            <AdminMetric
              symbol="▣"
              label="Собственные магазины"
              value={owners.length}
            />
            <AdminMetric
              symbol="◈"
              label="Единиц товара на складе"
              value={loading ? '…' : error ? '—' : total('physicalUnits')}
            />
            <AdminMetric
              symbol="↗"
              label="Выручка (за всё время)"
              value={
                loading ? '…' : error ? '—' : formatSom(total('revenueMinor'))
              }
            />
            <AdminMetric
              symbol="▤"
              label="Открытые заказы"
              value={loading ? '…' : error ? '—' : total('openOrders')}
            />
          </div>
        </>
      )}
      <AdminCard
        title="Доступные магазины"
        subtitle="Управление в пределах выданной роли"
        className="partner-stores"
      >
        <div className="table-wrap">
          <table className="admin-kit-table">
            <thead>
              <tr>
                <th>Магазин</th>
                <th>Ваша роль</th>
                <th>Остатки, шт.</th>
                <th>Выручка</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const row = summaries.find((s) => s.id === shop.id),
                  base = `/seller/${shop.id}`;
                return (
                  <tr key={shop.id}>
                    <td>
                      <strong>{shop.name}</strong>
                    </td>
                    <td>
                      {
                        {
                          owner: 'Владелец',
                          manager: 'Менеджер',
                          cashier: 'Кассир',
                        }[shop.role]
                      }
                    </td>
                    <td>{row?.physicalUnits ?? '—'}</td>
                    <td>{row ? formatSom(row.revenueMinor) : '—'}</td>
                    <td>
                      <div className="partner-links">
                        <Link to={shopStart(shop)}>Открыть магазин</Link>
                        <Link to={`${base}/pos`}>Касса</Link>
                        <Link to={`${base}/products`}>Товары</Link>
                        <Link to={`${base}/sales`}>Продажи</Link>
                        <Link to={`${base}/shift`}>Смена</Link>
                        {shop.role === 'owner' && (
                          <Link to={`${base}/reports`}>Отчёт</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </>
  );
}
