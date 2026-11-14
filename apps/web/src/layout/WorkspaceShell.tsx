import { useEffect, useState, type ReactNode } from 'react';
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

function NavIcon({ label }: { label: string }) {
  switch (label) {
    case 'Главная':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m3 10.5 9-7.5 9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h4.5v-6h3v6H18a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case 'Касса':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="17" cy="20" r="1.5" />
          <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.8a1.5 1.5 0 0 0 1.5-1.1L21 7H6" />
        </svg>
      );
    case 'Приёмка':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5M12 15V3" />
        </svg>
      );
    case 'Клиенты':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2M17 7a3.5 3.5 0 0 1 0 7M18 17a5 5 0 0 1 3.5 4" />
        </svg>
      );
    case 'Товары':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      );
    case 'Отчёты':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19h16M8 15V9M12 15V5M16 15v-3" />
        </svg>
      );
    case 'Ещё':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <circle cx="19" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
    case 'Обзор':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      );
    case 'Модерация товаров':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'Партнёры':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'Баннеры витрины':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    case 'Финансовый доступ':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    case 'Аудит':
    case 'Журнал решений':
      return (
        <svg
          className="workspace-nav-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    default:
      return null;
  }
}

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
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, location.search]);
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
  const hasMoreGroup = groups.some((group) => group.label === 'Ещё');
  const avatarText = user.email.trim().slice(0, 2).toUpperCase() || 'MS';
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
                  className={`workspace-more${group.items.some((item) => item.active) ? ' has-active' : ''}`}
                  open={
                    moreOpen ||
                    (typeof window !== 'undefined' &&
                      window.innerWidth > 820 &&
                      group.items.some((item) => item.active))
                  }
                  onToggle={(e) => setMoreOpen(e.currentTarget.open)}
                >
                  <summary>
                    <NavIcon label="Ещё" />
                    <span>Ещё</span>
                  </summary>
                  <div className="workspace-more-sheet">
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
                    <InstallApp className="workspace-install workspace-install-more" />
                  </div>
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
                      <NavIcon label={item.label} />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          ))}
        </nav>
        {!hasMoreGroup && <InstallApp className="workspace-install" />}
        <div className="sidebar-bottom admin-kit-sidebar-bottom">
          <span className="workspace-mobile-avatar" aria-hidden="true">
            {avatarText}
          </span>
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
