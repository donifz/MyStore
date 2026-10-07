import { useEffect, useState } from 'react';
import {
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { errorText } from '../api/client';
export function ShopSelect() {
  const s = useSession();
  if (s.loading) return <p className="loading">Загрузка…</p>;
  if (!s.user) return <Navigate to="/seller/login" replace />;
  if (s.user.shops.length === 1)
    return (
      <Navigate to={'/seller/' + s.user.shops[0].id + '/products'} replace />
    );
  return (
    <main className="chooser">
      <h1>Выберите магазин</h1>
      {s.user.shops.map((shop) => (
        <NavLink
          className="panel"
          key={shop.id}
          to={'/seller/' + shop.id + '/products'}
        >
          {shop.name}
        </NavLink>
      ))}
      {!s.user.shops.length && <p>Доступ к магазину пока не выдан.</p>}
    </main>
  );
}
export default function SellerLayout() {
  const s = useSession(),
    { shopId } = useParams(),
    navigate = useNavigate(),
    [error, setError] = useState('');
  const shop = s.user?.shops.find((x) => x.id === shopId);
  useEffect(() => {
    if (shop) s.selectShop(shop.id);
  }, [shop?.id]);
  if (s.loading) return <p className="loading">Загрузка…</p>;
  if (!s.user) return <Navigate to="/seller/login" replace />;
  if (!shop)
    return (
      <p role="alert" className="error">
        Нет доступа к магазину
      </p>
    );
  const base = '/seller/' + shop.id;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/seller" className="brand">
          MyStore<span>Рабочее пространство</span>
        </NavLink>
        <div className="shop-badge">
          <small>Ваш магазин</small>
          <strong>{shop.name}</strong>
          <select
            aria-label="Магазин"
            value={shop.id}
            onChange={(e) =>
              navigate('/seller/' + e.target.value + '/products')
            }
          >
            {s.user.shops.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <nav>
          {shop.role === 'owner' && (
            <NavLink to={base + '/storefront'}>Витрина</NavLink>
          )}
          <NavLink to={base + '/products'}>Товары</NavLink>
          {shop.role !== 'cashier' && (
            <NavLink to={base + '/receiving'}>Приёмка</NavLink>
          )}
          <NavLink to={base + '/pos'}>Касса</NavLink>
          <NavLink to={base + '/shift'}>Смена</NavLink>
          <NavLink to={base + '/sales'}>Продажи и возвраты</NavLink>
        </nav>
        <div className="sidebar-bottom">
          <small>{s.user.email}</small>
          <button
            onClick={() => {
              void s.logout().catch((e) => setError(errorText(e)));
            }}
          >
            Выйти
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>{shop.name}</span>
          <span className="badge">
            {shop.role === 'owner'
              ? 'Владелец'
              : shop.role === 'manager'
                ? 'Менеджер'
                : 'Кассир'}
          </span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
