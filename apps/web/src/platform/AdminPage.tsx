import { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import WorkspaceShell from '../layout/WorkspaceShell';
import {
  platformSection,
  type PlatformSection,
} from '../layout/workspace-navigation';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { AdminCard, AdminEmpty, AdminMetric, AdminStatus } from './AdminKit';

type Application = {
  id: string;
  shop_name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  category: string;
  status: 'new' | 'in_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
};
type Product = {
  revision_id: string;
  variant_id: string;
  shop_name: string;
  name: string;
  description: string;
  category: string;
  has_photo: boolean;
  has_publication: boolean;
};
type Revision = Product & {
  approved_name: string | null;
  approved_description: string | null;
  approved_category: string | null;
  approved_has_photo: boolean;
  status: string;
};
type Audit = {
  kind: string;
  entity_id: string;
  status: string;
  reason: string | null;
  created_at: string;
};
type Page<T> = { items: T[]; total: number };

type AdminOverview = {
  shopCount: number;
  openShifts: number;
  pendingPartners: number;
  pendingProducts: number;
  todaySalesMinor: number;
  sales: { day: string; totalMinor: number }[];
  categories: { name: string; totalMinor: number }[];
  shops: {
    id: string;
    name: string;
    ownerEmail: string | null;
    units: number;
    shiftOpen: boolean;
    lastShiftAt: string | null;
  }[];
};
const money = (minor: number) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(minor / 100) + ' сом';

export default function AdminPage() {
  const session = useSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [reason, setReason] = useState('');
  const [invitation, setInvitation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const tab = platformSection(location.search);
  function setTab(section: PlatformSection) {
    const next = new URLSearchParams(params);
    next.set('section', section);
    setParams(next);
  }
  const [search, setSearch] = useState('');
  async function load() {
    const [a, p, h, summary] = await Promise.all([
      api<Page<Application>>('/platform/admin/applications'),
      api<Page<Product>>('/platform/admin/products'),
      api<Page<Audit>>('/platform/admin/audit'),
      api<AdminOverview>('/platform/admin/overview'),
    ]);
    setApplications(a.items);
    setProducts(p.items);
    setAudit(h.items);
    setOverview(summary);
    setLoading(false);
  }
  useEffect(() => {
    if (!session.user?.platformAdmin) return;
    void load().catch((e) => {
      setError(errorText(e));
      setLoading(false);
    });
  }, [session.user?.userId]);
  async function decideApplication(
    row: Application,
    decision: 'in_review' | 'approved' | 'rejected',
  ) {
    setError('');
    setInvitation('');
    setBusy(true);
    try {
      const result = await api<{ activationUrl?: string }>(
        `/platform/admin/applications/${row.id}/decision`,
        {
          method: 'POST',
          body: { expectedStatus: row.status, decision, reason },
        },
      );
      if (result.activationUrl)
        setInvitation(window.location.origin + result.activationUrl);
      setReason('');
      await load();
    } catch (e) {
      setError(errorText(e));
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function showProduct(id: string) {
    setError('');
    setReason('');
    try {
      setSelected(
        await api<Revision>(`/platform/admin/products/revisions/${id}`),
      );
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function decideProduct(decision: 'approved' | 'rejected') {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api(
        `/platform/admin/products/revisions/${selected.revision_id}/decision`,
        {
          method: 'POST',
          body: { decision, reason },
        },
      );
      setSelected(null);
      setReason('');
      await load();
    } catch (e) {
      setError(errorText(e));
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  if (session.loading) return <p className="loading">Загрузка…</p>;
  if (!session.user)
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (!session.user.platformAdmin)
    return (
      <WorkspaceShell>
        <p role="alert" className="error">
          Нет доступа к кабинету платформы.
        </p>
      </WorkspaceShell>
    );
  const waiting = applications.filter((a) =>
    ['new', 'in_review'].includes(a.status),
  );
  const visibleApps = applications.filter((a) =>
    [a.shop_name, a.email, a.city].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const visibleProducts = products.filter((p) =>
    [p.name, p.shop_name, p.category].some((value) =>
      value.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const appStatus = (status: Application['status']) =>
    status === 'approved'
      ? 'Одобрена'
      : status === 'rejected'
        ? 'Отклонена'
        : status === 'in_review'
          ? 'Проверяется'
          : 'Новая';

  const applicationsTable = (
    <AdminCard
      title="Заявки партнёров"
      subtitle="Регистрация и проверка партнёров платформы"
      action={
        <button onClick={() => setTab('applications')}>Все заявки →</button>
      }
    >
      {!visibleApps.length ? (
        <AdminEmpty>Заявок пока нет</AdminEmpty>
      ) : (
        <div className="admin-kit-scroll">
          <table className="admin-kit-table">
            <thead>
              <tr>
                <th>Партнёр</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleApps.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.shop_name}</strong>
                    <small>{a.email}</small>
                    <small>
                      {a.city} · {a.address}
                    </small>
                  </td>
                  <td>{a.category}</td>
                  <td>
                    <AdminStatus
                      tone={
                        a.status === 'approved'
                          ? 'green'
                          : a.status === 'rejected'
                            ? 'red'
                            : 'amber'
                      }
                    >
                      {appStatus(a.status)}
                    </AdminStatus>
                  </td>
                  <td>{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                  <td>
                    {['new', 'in_review'].includes(a.status) ? (
                      <div className="admin-kit-actions">
                        {a.status === 'new' && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              void decideApplication(a, 'in_review')
                            }
                          >
                            Проверить
                          </button>
                        )}
                        <button
                          className="admin-kit-approve"
                          disabled={busy}
                          onClick={() => void decideApplication(a, 'approved')}
                        >
                          Одобрить
                        </button>
                        <button
                          className="admin-kit-reject"
                          disabled={busy || !reason.trim()}
                          onClick={() => void decideApplication(a, 'rejected')}
                        >
                          Отклонить
                        </button>
                      </div>
                    ) : (
                      <span className="muted">Решение принято</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );

  const productsTable = (
    <AdminCard
      title="Модерация товаров"
      subtitle="Карточки магазинов на проверке"
      action={<button onClick={() => setTab('products')}>Все товары →</button>}
    >
      {!visibleProducts.length ? (
        <AdminEmpty>Нет карточек на проверке</AdminEmpty>
      ) : (
        <div className="admin-kit-scroll">
          <table className="admin-kit-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Магазин</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.revision_id}>
                  <td>
                    <strong>{p.name}</strong>
                    <small>{p.description}</small>
                  </td>
                  <td>{p.shop_name}</td>
                  <td>{p.category || 'Не указана'}</td>
                  <td>
                    <AdminStatus>На проверке</AdminStatus>
                  </td>
                  <td>
                    <button onClick={() => void showProduct(p.revision_id)}>
                      Посмотреть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );

  return (
    <WorkspaceShell
      headerTools={
        <label className="admin-kit-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Поиск по заявкам и товарам"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск партнёров, магазинов, товаров..."
          />
        </label>
      }
    >
      <div className="admin-kit-heading">
        <div>
          <h1>Администрирование MyStore</h1>
          <p>Контроль партнёров, магазинов и операций</p>
        </div>
        <span className="admin-kit-date">
          {new Date().toLocaleDateString('ru-RU', { dateStyle: 'long' })}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {invitation && (
        <AdminCard
          title="Ссылка для владельца"
          subtitle="Передайте по проверенному контакту. Действует 7 дней."
        >
          <input
            aria-label="Ссылка активации"
            readOnly
            value={invitation}
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={() =>
              void navigator.clipboard
                .writeText(invitation)
                .catch((e) => setError(errorText(e)))
            }
          >
            Скопировать
          </button>
        </AdminCard>
      )}
      {loading ? (
        <p role="status">Загрузка данных…</p>
      ) : (
        <>
          <div className="admin-kit-metrics">
            <AdminMetric
              symbol="▣"
              label="Магазины платформы"
              value={overview?.shopCount ?? '—'}
              note="Магазинов на платформе"
            />
            <AdminMetric
              symbol="♙"
              tone="amber"
              label="Партнёры на модерации"
              value={overview?.pendingPartners ?? '—'}
              note="Ожидают решения"
            />
            <AdminMetric
              symbol="▤"
              label="Продажи за сегодня"
              value={overview ? money(overview.todaySalesMinor) : '—'}
              note="Платежи с учётом возвратов"
            />
            <AdminMetric
              symbol="◷"
              tone="blue"
              label="Открытые смены"
              value={overview?.openShifts ?? '—'}
              note="На всех магазинах"
            />
          </div>
          {tab === 'overview' ? (
            <div className="admin-kit-grid">
              <div className="admin-kit-primary">
                {applicationsTable}
                {productsTable}

                <AdminCard
                  title="Магазины"
                  subtitle="Текущие остатки и последние смены"
                >
                  {!overview?.shops.length ? (
                    <AdminEmpty>Магазины пока не зарегистрированы</AdminEmpty>
                  ) : (
                    <div className="admin-kit-scroll">
                      <table className="admin-kit-table">
                        <thead>
                          <tr>
                            <th>Магазин</th>
                            <th>Владелец</th>
                            <th>Остатки</th>
                            <th>Последняя смена</th>
                            <th>Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.shops.map((shop) => (
                            <tr key={shop.id}>
                              <td>
                                <strong>{shop.name}</strong>
                              </td>
                              <td>{shop.ownerEmail ?? 'Не указан'}</td>
                              <td>{shop.units} шт.</td>
                              <td>
                                {shop.lastShiftAt
                                  ? new Date(shop.lastShiftAt).toLocaleString(
                                      'ru-RU',
                                    )
                                  : 'Нет смен'}
                              </td>
                              <td>
                                <AdminStatus
                                  tone={shop.shiftOpen ? 'green' : 'neutral'}
                                >
                                  {shop.shiftOpen
                                    ? 'Открыта'
                                    : 'Нет открытой смены'}
                                </AdminStatus>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </AdminCard>
              </div>
              <div className="admin-kit-secondary">
                <AdminCard
                  title="Продажи"
                  subtitle="Последние 7 дней с учётом возвратов"
                >
                  {overview && (
                    <>
                      <strong className="admin-kit-chart-total">
                        {money(
                          overview.sales.reduce(
                            (sum, point) => sum + point.totalMinor,
                            0,
                          ),
                        )}
                      </strong>
                      <div
                        className="admin-kit-chart"
                        aria-label="График продаж за 7 дней"
                      >
                        {overview.sales.map((point) => {
                          const max = Math.max(
                            1,
                            ...overview.sales.map((x) =>
                              Math.max(0, x.totalMinor),
                            ),
                          );
                          return (
                            <div
                              key={point.day}
                              className="admin-kit-chart-column"
                            >
                              <div className="admin-kit-chart-bar">
                                <span
                                  style={{
                                    height: `${Math.max(2, (100 * Math.max(0, point.totalMinor)) / max)}%`,
                                  }}
                                  title={`${point.day}: ${money(point.totalMinor)}`}
                                />
                              </div>
                              <small>{point.day.slice(5)}</small>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </AdminCard>
                <AdminCard
                  title="Популярные категории"
                  subtitle="Валовые продажи по топ-5 категориям"
                >
                  {!overview?.categories.length ? (
                    <AdminEmpty>Продаж по категориям пока нет</AdminEmpty>
                  ) : (
                    <div className="admin-kit-category-bars">
                      {overview.categories.map((category) => {
                        const total = overview.categories.reduce(
                          (sum, item) => sum + item.totalMinor,
                          0,
                        );
                        const share = total
                          ? Math.round((100 * category.totalMinor) / total)
                          : 0;
                        return (
                          <div key={category.name}>
                            <span>
                              {category.name}
                              <small>{share}%</small>
                            </span>
                            <div>
                              <span style={{ width: `${share}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AdminCard>
                <AdminCard
                  title="Недавняя активность"
                  subtitle="Решения администрации"
                >
                  {!audit.length ? (
                    <AdminEmpty>Событий пока нет</AdminEmpty>
                  ) : (
                    <div className="admin-kit-activity">
                      {audit.slice(0, 7).map((event, index) => (
                        <div key={event.entity_id + index}>
                          <span className="admin-kit-activity-dot">✓</span>
                          <div>
                            <strong>
                              {event.kind} · {event.status}
                            </strong>
                            <small>
                              {new Date(event.created_at).toLocaleString(
                                'ru-RU',
                              )}
                            </small>
                            {event.reason && <p>{event.reason}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AdminCard>
              </div>
            </div>
          ) : tab === 'applications' ? (
            <>
              <label className="admin-kit-reason">
                Причина отклонения (для отказа обязательно)
                <input
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {applicationsTable}
            </>
          ) : tab === 'products' ? (
            <>
              {productsTable}
              {selected && (
                <AdminCard
                  title={`Предложено: ${selected.name}`}
                  subtitle={selected.shop_name}
                >
                  {selected.has_photo && (
                    <img
                      className="product-photo"
                      src={`/api/platform/admin/products/revisions/${selected.revision_id}/photo`}
                      alt="Фото для проверки"
                    />
                  )}
                  <p>
                    {selected.category} · {selected.description}
                  </p>
                  <h3>
                    Сейчас на витрине:{' '}
                    {selected.approved_name ?? 'Ещё не опубликовано'}
                  </h3>
                  {selected.approved_has_photo && (
                    <img
                      className="product-photo"
                      src={`/api/platform/admin/products/revisions/${selected.revision_id}/photo?approved=true`}
                      alt="Одобренное фото"
                    />
                  )}
                  <p>
                    {selected.approved_category} ·{' '}
                    {selected.approved_description}
                  </p>
                  <label className="admin-kit-reason">
                    Причина отказа
                    <input
                      value={reason}
                      maxLength={500}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="admin-kit-actions">
                    <button
                      className="admin-kit-approve"
                      disabled={busy}
                      onClick={() => void decideProduct('approved')}
                    >
                      Одобрить карточку
                    </button>
                    <button
                      className="admin-kit-reject"
                      disabled={busy || !reason.trim()}
                      onClick={() => void decideProduct('rejected')}
                    >
                      Отклонить карточку
                    </button>
                  </div>
                </AdminCard>
              )}
            </>
          ) : (
            <AdminCard
              title="Журнал решений"
              subtitle="История действий модерации"
            >
              {!audit.length ? (
                <AdminEmpty>Решений пока нет</AdminEmpty>
              ) : (
                <div className="admin-kit-activity">
                  {audit.map((event, index) => (
                    <div key={event.entity_id + index}>
                      <span className="admin-kit-activity-dot">✓</span>
                      <div>
                        <strong>
                          {event.kind} · {event.status}
                        </strong>
                        <small>
                          {new Date(event.created_at).toLocaleString('ru-RU')}
                        </small>
                        {event.reason && <p>{event.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
