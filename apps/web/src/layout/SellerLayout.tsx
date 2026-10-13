import { AdminBrand, AdminIdentity } from '../platform/AdminKit';
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
  const [error, setError] = useState('');
  if (s.loading) return <p className="loading">Загрузка…</p>;
  if (!s.user) return <Navigate to="/seller/login" replace />;
  if (s.user.shops.length === 1)
    return (
      <Navigate to={'/seller/' + s.user.shops[0].id + '/products'} replace />
    );
  return (
    <div className="admin-kit-shell">
      <aside className="admin-kit-sidebar">
        <AdminBrand to="/seller" subtitle="Рабочее пространство" />
        <nav aria-label="Разделы кабинета">
          <NavLink end to="/seller">
            Мои магазины
          </NavLink>
          {s.user.platformAdmin && (
            <NavLink to="/platform/admin">Кабинет платформы</NavLink>
          )}
        </nav>
        <div className="admin-kit-sidebar-bottom">
          <span>{s.user.email}</span>
          <button
            onClick={() => void s.logout().catch((e) => setError(errorText(e)))}
          >
            Выйти
          </button>
        </div>
      </aside>
      <div className="admin-kit-main">
        <header className="admin-kit-topbar">
          <span>MyStore / Магазины</span>
          <AdminIdentity
            email={s.user.email}
            role={s.user.platformAdmin ? 'Администратор' : 'Сотрудник'}
          />
        </header>
        <main className="admin-kit-content">
          <div className="admin-kit-heading">
            <h1>Выберите магазин</h1>
          </div>
          <div className="shop-chooser-cards">
            {s.user.shops.map((shop) => (
              <NavLink
                className="panel"
                key={shop.id}
                to={`/seller/${shop.id}/products`}
              >
                <strong>{shop.name}</strong>
                <span>Открыть кабинет →</span>
              </NavLink>
            ))}
            {!s.user.shops.length && (
              <p className="panel">Доступ к магазину пока не выдан.</p>
            )}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </main>
      </div>
    </div>
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
  const roleLabel =
    shop.role === 'owner'
      ? 'Владелец'
      : shop.role === 'manager'
        ? 'Менеджер'
        : 'Кассир';
  const base = '/seller/' + shop.id;
  return (
    <div className="app-shell admin-kit-shell">
      <aside className="sidebar admin-kit-sidebar">
        <AdminBrand to="/seller" subtitle="Рабочее пространство" />
        <div
          className={`shop-badge${s.user.shops.length > 1 ? ' shop-badge-multiple' : ''}`}
        >
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
        <nav aria-label="Разделы магазина">
          {s.user.platformAdmin && (
            <NavLink to="/platform/admin">Кабинет платформы</NavLink>
          )}
          {shop.role === 'owner' && (
            <NavLink to={base + '/storefront'}>Витрина</NavLink>
          )}
          {shop.role === 'owner' && (
            <NavLink to={base + '/staff'}>Сотрудники</NavLink>
          )}
          <NavLink end to={base + '/products'}>
            Товары
          </NavLink>
          <NavLink to={base + '/labels'}>Печать этикеток</NavLink>
          {shop.role !== 'cashier' && (
            <NavLink to={base + '/categories'}>Категории</NavLink>
          )}
          {shop.role !== 'cashier' && (
            <>
              <NavLink to={base + '/products/capture'}>
                Скан / фото товара
              </NavLink>
              <NavLink to={base + '/receiving'}>Приёмка</NavLink>
              <NavLink to={base + '/inventory'}>Инвентаризация</NavLink>
            </>
          )}
          <NavLink to={base + '/orders'}>Заказы</NavLink>
          <NavLink to={base + '/operations'}>Уведомления</NavLink>
          <NavLink to={base + '/pos'}>Касса</NavLink>
          <NavLink to={base + '/shift'}>Смена</NavLink>
          <NavLink to={base + '/sales'}>Продажи и возвраты</NavLink>
          {shop.role === 'owner' && (
            <NavLink to={base + '/reports'}>Отчёты</NavLink>
          )}
        </nav>
        <div className="sidebar-bottom admin-kit-sidebar-bottom">
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
      <div className="workspace admin-kit-main">
        <header className="topbar admin-kit-topbar">
          <span>{shop.name}</span>
          <AdminIdentity email={s.user.email} role={roleLabel} />
        </header>
        <main className="content admin-kit-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
