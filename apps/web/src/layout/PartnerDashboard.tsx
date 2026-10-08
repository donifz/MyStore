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
  const shops = session.user?.shops.filter((shop) => shop.role === 'owner') ?? [];
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
  if (!shops.length) {
    if (session.user.shops.length === 1)
      return (
        <Navigate
          to={`/seller/${session.user.shops[0].id}/products`}
          replace
        />
      );
    return (
      <main className="chooser">
        <h1>Мои магазины</h1>
        {session.user.shops.map((shop) => (
          <Link className="panel" key={shop.id} to={`/seller/${shop.id}/products`}>
            {shop.name}
          </Link>
        ))}
        {session.user.platformAdmin && (
          <Link to="/platform/admin">Администрирование платформы</Link>
        )}
      </main>
    );
  }

  const total = (key: keyof Omit<StoreSummary, 'id'>) =>
    summaries.reduce((sum, row) => sum + row[key], 0);

  return (
    <div className="partner-shell">
      <aside className="partner-sidebar">
        <Link className="brand" to="/seller">
          MyStore<span>Панель партнёра</span>
        </Link>
        <nav aria-label="Разделы партнёра">
          <Link className="active" to="/seller">Обзор</Link>
          <a href="#partner-shops">Мои магазины</a>
          <a href="#partner-shops">Товары и остатки</a>
          <a href="#partner-shops">Продажи и смены</a>
          {session.user.platformAdmin && (
            <Link to="/platform/admin">Администрирование</Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <small>{session.user.email}</small>
        </div>
      </aside>
      <div className="partner-main">
        <header className="partner-topbar">
          <span>MyStore / Обзор</span>
          <span className="badge">Партнёр</span>
        </header>
        <main className="partner-content">
          <div className="partner-heading">
            <div>
              <h1>Панель партнёра MyStore</h1>
              <p className="muted">Только ваши магазины, товары, продажи и смены</p>
            </div>
            <span className="partner-access">Доступ к своим магазинам</span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="partner-stats">
            <article className="panel">
              <small>Мои магазины</small>
              <h2>{shops.length}</h2>
            </article>
            <article className="panel">
              <small>Единиц товара на складе</small>
              <h2>{loading ? '…' : error ? '—' : total('physicalUnits')}</h2>
            </article>
            <article className="panel">
              <small>Выручка (за всё время)</small>
              <h2>
                {loading ? '…' : error ? '—' : formatSom(total('revenueMinor'))}
              </h2>
            </article>
            <article className="panel">
              <small>Открытые заказы</small>
              <h2>{loading ? '…' : error ? '—' : total('openOrders')}</h2>
            </article>
          </div>
          <section className="panel partner-stores" id="partner-shops">
            <div className="partner-section-heading">
              <div>
                <h2>Мои магазины</h2>
                <p className="muted">Управление кассой, товарами и остатками</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
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
                        <td><strong>{shop.name}</strong></td>
                        <td>{row?.physicalUnits ?? '—'}</td>
                        <td>{row ? formatSom(row.revenueMinor) : '—'}</td>
                        <td>{row?.openOrders ?? '—'}</td>
                        <td>
                          <div className="partner-links">
                            <Link to={base + '/pos'}>Касса</Link>
                            <Link to={base + '/products'}>Товары</Link>
                            <Link to={base + '/reports'}>Отчёт</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <p className="muted">
            Показатели суммируются только по вашим магазинам. Модерация
            чужих магазинов и управление платформой недоступны партнёрам.
          </p>
        </main>
      </div>
    </div>
  );
}
