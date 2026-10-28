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
import type { PlatformFinancialGrant, FinancialSummary } from '../api/types';

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
  pendingPartners: number;
  pendingProducts: number;
  shops: {
    id: string;
    name: string;
    city?: string;
    published?: boolean;
    marketplaceBlocked?: boolean;
    marketplaceBlockReason?: string | null;
    subscriptionUntil?: string | null;
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
  const [grants, setGrants] = useState<PlatformFinancialGrant[]>([]);
  const [selectedGrant, setSelectedGrant] =
    useState<PlatformFinancialGrant | null>(null);
  const [summaryData, setSummaryData] = useState<FinancialSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [selected, setSelected] = useState<Revision | null>(null);
  const [reason, setReason] = useState('');
  const [invitation, setInvitation] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockModalShopId, setBlockModalShopId] = useState<string | null>(null);
  const [blockModalReason, setBlockModalReason] = useState('');
  const [subModalShopId, setSubModalShopId] = useState<string | null>(null);
  const [subModalDate, setSubModalDate] = useState('');
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
    const [a, p, h, summary, g] = await Promise.all([
      api<Page<Application>>('/platform/admin/applications'),
      api<Page<Product>>('/platform/admin/products'),
      api<Page<Audit>>('/platform/admin/audit'),
      api<AdminOverview>('/platform/admin/overview'),
      api<{ items: PlatformFinancialGrant[] }>(
        '/platform/admin/financial-access',
      ).catch(() => ({ items: [] })),
    ]);
    setApplications(a.items);
    setProducts(p.items);
    setAudit(h.items);
    setOverview(summary);
    setGrants(g.items);
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
    credentialDelivery?: 'invite' | 'password',
  ) {
    setError('');
    setInvitation('');
    setGeneratedPassword('');
    setBusy(true);
    try {
      const result = await api<{
        activationUrl?: string;
        generatedPassword?: string;
      }>(`/platform/admin/applications/${row.id}/decision`, {
        method: 'POST',
        body: {
          expectedStatus: row.status,
          decision,
          reason,
          ...(credentialDelivery ? { credentialDelivery } : {}),
        },
      });
      if (result.activationUrl)
        setInvitation(window.location.origin + result.activationUrl);
      if (result.generatedPassword)
        setGeneratedPassword(result.generatedPassword);
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
  async function openSummary(grant: PlatformFinancialGrant) {
    setSelectedGrant(grant);
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const data = await api<FinancialSummary>(
        `/platform/admin/financial-access/${grant.id}/summary`,
      );
      setSummaryData(data);
    } catch (e) {
      setSummaryError(errorText(e));
    } finally {
      setSummaryLoading(false);
    }
  }

  async function toggleMarketplaceBlock(
    shopId: string,
    blocked: boolean,
    blockReason?: string,
  ) {
    setBusy(true);
    setError('');
    try {
      await api(`/platform/admin/shops/${shopId}/marketplace-status`, {
        method: 'POST',
        body: { blocked, reason: blockReason },
      });
      setBlockModalShopId(null);
      setBlockModalReason('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveSubscription(shopId: string, until: string | null) {
    setBusy(true);
    setError('');
    try {
      await api(`/platform/admin/shops/${shopId}/subscription`, {
        method: 'POST',
        body: { until },
      });
      setSubModalShopId(null);
      setSubModalDate('');
      await load();
    } catch (e) {
      setError(errorText(e));
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
                          className="admin-kit-approve"
                          disabled={busy}
                          onClick={() =>
                            void decideApplication(a, 'approved', 'password')
                          }
                        >
                          Одобрить и выдать пароль
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
      {generatedPassword && (
        <AdminCard
          title="Пароль для партнёра"
          subtitle="Передайте пароль партнёру вручную. Он показан только сейчас."
        >
          <input
            aria-label="Сгенерированный пароль"
            readOnly
            value={generatedPassword}
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={() =>
              void navigator.clipboard
                .writeText(generatedPassword)
                .catch((e) => setError(errorText(e)))
            }
          >
            Скопировать пароль
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
              note="Всего зарегистрировано"
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
              label="Товары на модерации"
              value={overview?.pendingProducts ?? '—'}
              note="Карточки на проверке"
            />
          </div>
          {tab === 'overview' ? (
            <div className="admin-kit-grid">
              <div className="admin-kit-primary">
                {applicationsTable}
                {productsTable}

                <AdminCard
                  title="Магазины"
                  subtitle="Зарегистрированные магазины платформы"
                >
                  {blockModalShopId && (
                    <div
                      className="panel form-panel"
                      style={{
                        marginBottom: '1rem',
                        border: '1px solid #b3261e',
                        borderRadius: '8px',
                        padding: '1rem',
                      }}
                    >
                      <h3>Блокировка витрины магазина на маркетплейсе</h3>
                      <p className="muted">
                        Магазин и его товары будут скрыты из каталога и поиска
                        маркетплейса. Локальная касса магазина останется
                        активной.
                      </p>
                      <label>
                        Причина блокировки
                        <input
                          type="text"
                          placeholder="Например: Неоплата подписки, нарушение правил"
                          value={blockModalReason}
                          onChange={(e) => setBlockModalReason(e.target.value)}
                          autoFocus
                        />
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          marginTop: '0.75rem',
                        }}
                      >
                        <button
                          className="admin-kit-reject"
                          disabled={busy || !blockModalReason.trim()}
                          onClick={() =>
                            void toggleMarketplaceBlock(
                              blockModalShopId,
                              true,
                              blockModalReason.trim(),
                            )
                          }
                        >
                          Подтвердить блокировку
                        </button>
                        <button
                          type="button"
                          onClick={() => setBlockModalShopId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}

                  {subModalShopId && (
                    <div
                      className="panel form-panel"
                      style={{
                        marginBottom: '1rem',
                        border: '1px solid var(--color-border, #ddd)',
                        borderRadius: '8px',
                        padding: '1rem',
                      }}
                    >
                      <h3>Управление подпиской магазина</h3>
                      <label>
                        Дата окончания подписки
                        <input
                          type="date"
                          value={subModalDate}
                          onChange={(e) => setSubModalDate(e.target.value)}
                        />
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          marginTop: '0.75rem',
                        }}
                      >
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            void saveSubscription(
                              subModalShopId,
                              subModalDate
                                ? new Date(
                                    subModalDate + 'T23:59:59.999Z',
                                  ).toISOString()
                                : null,
                            )
                          }
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void saveSubscription(subModalShopId, null)
                          }
                        >
                          Снять ограничение (Бессрочно)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubModalShopId(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}

                  {!overview?.shops.length ? (
                    <AdminEmpty>Магазины пока не зарегистрированы</AdminEmpty>
                  ) : (
                    <div className="admin-kit-scroll">
                      <table className="admin-kit-table">
                        <thead>
                          <tr>
                            <th>Магазин</th>
                            <th>Город</th>
                            <th>Витрина</th>
                            <th>Подписка</th>
                            <th>Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.shops.map((shop) => (
                            <tr key={shop.id}>
                              <td>
                                <strong>{shop.name}</strong>
                                {shop.marketplaceBlocked &&
                                  shop.marketplaceBlockReason && (
                                    <small
                                      style={{
                                        color: '#b3261e',
                                        display: 'block',
                                        marginTop: '0.2rem',
                                      }}
                                    >
                                      Причина: {shop.marketplaceBlockReason}
                                    </small>
                                  )}
                              </td>
                              <td>{shop.city || '—'}</td>
                              <td>
                                {shop.marketplaceBlocked ? (
                                  <AdminStatus tone="red">
                                    Заблокирован
                                  </AdminStatus>
                                ) : (
                                  <AdminStatus
                                    tone={shop.published ? 'green' : 'neutral'}
                                  >
                                    {shop.published
                                      ? 'Опубликован'
                                      : 'Черновик'}
                                  </AdminStatus>
                                )}
                              </td>
                              <td>
                                {shop.subscriptionUntil ? (
                                  <span>
                                    до{' '}
                                    {new Date(
                                      shop.subscriptionUntil,
                                    ).toLocaleDateString('ru-RU')}
                                  </span>
                                ) : (
                                  <span className="muted">Бессрочно</span>
                                )}
                              </td>
                              <td>
                                <div className="admin-kit-actions">
                                  {shop.marketplaceBlocked ? (
                                    <button
                                      disabled={busy}
                                      onClick={() =>
                                        void toggleMarketplaceBlock(
                                          shop.id,
                                          false,
                                        )
                                      }
                                    >
                                      Разблокировать
                                    </button>
                                  ) : (
                                    <button
                                      className="admin-kit-reject"
                                      disabled={busy}
                                      onClick={() => {
                                        setBlockModalShopId(shop.id);
                                        setBlockModalReason('');
                                      }}
                                    >
                                      Блокировать
                                    </button>
                                  )}
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      setSubModalShopId(shop.id);
                                      setSubModalDate(
                                        shop.subscriptionUntil
                                          ? new Date(shop.subscriptionUntil)
                                              .toISOString()
                                              .slice(0, 10)
                                          : '',
                                      );
                                    }}
                                  >
                                    Подписка
                                  </button>
                                </div>
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
          ) : tab === 'financial-access' ? (
            <div className="admin-kit-grid">
              <div className="admin-kit-primary">
                <AdminCard
                  title="Финансовый доступ платформы"
                  subtitle="Полномочия на чтение финансовой сводки, выданные владельцами магазинов"
                >
                  {!grants.length ? (
                    <AdminEmpty>
                      Владельцы магазинов пока не выдавали вам доступ к
                      финансовой сводке.
                    </AdminEmpty>
                  ) : (
                    <div className="admin-kit-scroll">
                      <table className="admin-kit-table">
                        <thead>
                          <tr>
                            <th>Магазин</th>
                            <th>Цель доступа</th>
                            <th>Срок действия</th>
                            <th>Статус</th>
                            <th>Действие</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grants.map((g) => {
                            const isExpired =
                              new Date(g.expiresAt).getTime() <= Date.now();
                            const isRevoked = !!g.revokedAt;
                            return (
                              <tr key={g.id}>
                                <td>
                                  <strong>{g.shopName}</strong>
                                </td>
                                <td>
                                  <span title={g.purpose}>{g.purpose}</span>
                                </td>
                                <td>
                                  <small>
                                    {new Date(g.createdAt).toLocaleString(
                                      'ru-RU',
                                    )}{' '}
                                    —{' '}
                                    {new Date(g.expiresAt).toLocaleString(
                                      'ru-RU',
                                    )}
                                  </small>
                                </td>
                                <td>
                                  <AdminStatus
                                    tone={g.active ? 'green' : 'neutral'}
                                  >
                                    {g.active
                                      ? 'Активен'
                                      : isRevoked
                                        ? 'Отозван'
                                        : isExpired
                                          ? 'Истёк'
                                          : 'Неактивен'}
                                  </AdminStatus>
                                </td>
                                <td>
                                  {g.active ? (
                                    <button
                                      type="button"
                                      disabled={
                                        summaryLoading &&
                                        selectedGrant?.id === g.id
                                      }
                                      onClick={() => void openSummary(g)}
                                    >
                                      {selectedGrant?.id === g.id && summaryData
                                        ? 'Обновить'
                                        : 'Открыть сводку'}
                                    </button>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </AdminCard>

                {selectedGrant && (
                  <AdminCard
                    title={`Финансовая сводка: ${selectedGrant.shopName}`}
                    subtitle={`Основание: ${selectedGrant.purpose}`}
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGrant(null);
                          setSummaryData(null);
                        }}
                      >
                        Закрыть сводку
                      </button>
                    }
                  >
                    <div
                      className="panel alert-banner"
                      style={{ marginBottom: 16 }}
                    >
                      <p>
                        <strong>Режим аудируемого чтения:</strong> Доступ
                        действует до{' '}
                        {new Date(selectedGrant.expiresAt).toLocaleString(
                          'ru-RU',
                        )}
                        . Каждое обращение к финансовым данным фиксируется в
                        журнале аудита магазина.
                      </p>
                    </div>

                    {summaryLoading ? (
                      <p className="loading">Загрузка финансовой сводки…</p>
                    ) : summaryError ? (
                      <p role="alert" className="error">
                        {summaryError}
                      </p>
                    ) : summaryData ? (
                      <div className="table-wrap">
                        <table className="admin-kit-table">
                          <tbody>
                            <tr>
                              <td>Выручка за вычетом возвратов</td>
                              <td>
                                <strong>
                                  {money(summaryData.revenueMinor)}
                                </strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Себестоимость проданного</td>
                              <td>{money(summaryData.costOfGoodsMinor)}</td>
                            </tr>
                            <tr>
                              <td>Валовая прибыль</td>
                              <td>
                                <strong>
                                  {money(summaryData.grossProfitMinor)}
                                </strong>
                              </td>
                            </tr>
                            <tr>
                              <td>Поступления (наличные / карта)</td>
                              <td>
                                {money(summaryData.cashReceivedMinor)} /{' '}
                                {money(summaryData.cardReceivedMinor)}
                              </td>
                            </tr>
                            <tr>
                              <td>Стоимость товарного остатка</td>
                              <td>{money(summaryData.stockValueMinor)}</td>
                            </tr>
                            <tr>
                              <td>Доступно / резерв</td>
                              <td>
                                {summaryData.physicalUnits -
                                  summaryData.reservedUnits}{' '}
                                шт. / {summaryData.reservedUnits} шт.
                              </td>
                            </tr>
                            <tr>
                              <td>Онлайн-заказы (открыто / выдано)</td>
                              <td>
                                {summaryData.openOrders} /{' '}
                                {summaryData.issuedOrders}
                              </td>
                            </tr>
                            <tr>
                              <td>Закрытые смены</td>
                              <td>{summaryData.closedShifts}</td>
                            </tr>
                            <tr>
                              <td>Расхождение по кассе</td>
                              <td>{money(summaryData.cashDiscrepancyMinor)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </AdminCard>
                )}
              </div>
            </div>
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
