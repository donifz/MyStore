import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { errorText } from '../api/client';
import { AdminBrand, AdminIdentity } from '../platform/AdminKit';
import { InstallApp } from '../pwa/InstallApp';
import {
  shopStart,
  workspaceContext,
  workspaceMenu,
  workspaceStart,
} from './workspace-navigation';
export default function WorkspaceShell({
  children,
  headerTools,
}: {
  children: ReactNode;
  headerTools?: ReactNode;
}) {
  const session = useSession(),
    location = useLocation(),
    navigate = useNavigate();
  const [error, setError] = useState('');
  if (session.loading)
    return (
      <p role="status" className="loading">
        Загрузка…
      </p>
    );
  if (!session.user)
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  const user = session.user,
    context = workspaceContext(user, location.pathname, location.search);
  const choices = [
    ...(user.platformAdmin
      ? [{ value: 'platform', label: 'Платформа', href: '/platform/admin' }]
      : []),
    ...user.shops.map((shop) => ({
      value: `shop:${shop.id}`,
      label: `Магазин: ${shop.name}`,
      href: shopStart(shop),
    })),
    ...(user.shops.length > 1
      ? [{ value: 'shops', label: 'Мои магазины', href: '/seller?view=shops' }]
      : []),
  ];
  const value =
    context.kind === 'shop' ? `shop:${context.shop.id}` : context.kind;
  const title =
    context.kind === 'shop'
      ? context.shop.name
      : context.kind === 'platform'
        ? 'Платформа'
        : context.kind === 'shops'
          ? 'Мои магазины'
          : 'Рабочий кабинет';
  const role =
    context.kind === 'platform'
      ? 'Администратор платформы'
      : context.kind === 'shop'
        ? { owner: 'Владелец', manager: 'Менеджер', cashier: 'Кассир' }[
            context.shop.role
          ]
        : context.kind === 'forbidden'
          ? 'Нет доступа'
          : context.kind === 'empty'
            ? 'Доступ пока не выдан'
            : 'Выбор магазина';
  const groups = workspaceMenu(context, location.pathname, location.search);
  return (
    <div
      className={`app-shell admin-kit-shell workspace-shell workspace-${context.kind}`}
    >
      <aside className="sidebar admin-kit-sidebar">
        <AdminBrand to={workspaceStart(user)} subtitle="Рабочий кабинет" />
        <div className="workspace-context">
          <label htmlFor="workspace-context-select">Рабочий контекст</label>
          <select
            id="workspace-context-select"
            value={value}
            disabled={!choices.length}
            onChange={(e) => {
              const choice = choices.find((c) => c.value === e.target.value);
              if (choice) navigate(choice.href);
            }}
          >
            {!choices.some((c) => c.value === value) && (
              <option value={value} disabled>
                {context.kind === 'empty'
                  ? 'Нет доступных магазинов'
                  : 'Выберите контекст'}
              </option>
            )}
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <small>{role}</small>
        </div>
        <nav aria-label="Разделы кабинета">
          {groups.map((group) => (
            <div className="workspace-nav-group" key={group.label}>
              {group.label === 'Ещё' ? (
                <details
                  className="workspace-more"
                  open={group.items.some((item) => item.active)}
                >
                  <summary>Ещё</summary>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={item.active ? 'active' : undefined}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
                </details>
              ) : (
                <>
                  <p className="workspace-nav-label">{group.label}</p>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={item.active ? 'active' : undefined}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          ))}
        </nav>
        <InstallApp className="workspace-install" />
        <div className="sidebar-bottom admin-kit-sidebar-bottom">
          <button
            onClick={() =>
              void session.logout().catch((e) => setError(errorText(e)))
            }
          >
            Выйти
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <div className="workspace admin-kit-main">
        <header className="topbar admin-kit-topbar">
          <div className="workspace-header-main">
            <span>{title}</span>
            {headerTools}
          </div>
          <AdminIdentity email={user.email} role="Аккаунт" />
        </header>
        <main className="content admin-kit-content">
          {context.kind === 'forbidden' ? (
            <p role="alert" className="error">
              Нет доступа к этому разделу. Выберите доступный контекст.
            </p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
