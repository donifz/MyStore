import Pagination from '../components/Pagination';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import WorkspaceShell from '../layout/WorkspaceShell';
import {
  platformSection,
  type PlatformSection,
} from '../layout/workspace-navigation';
import { api, ApiError, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { AdminCard, AdminEmpty, AdminMetric, AdminStatus } from './AdminKit';
import HeroSliderEditor, { type HeroSlide } from './HeroSliderEditor';
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
  subcategory?: string | null;
  created_at?: string;
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
const PRODUCTS_PAGE_SIZE = 10;
const APPLICATIONS_PAGE_SIZE = 10;
const SHOPS_PAGE_SIZE = 10;
const AUDIT_PAGE_SIZE = 15;
const productDate = (value?: string, withTime = false) => {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return withTime
    ? new Date(value).toLocaleString('ru-RU')
    : new Date(value).toLocaleDateString('ru-RU');
};

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
    hasOwner: boolean;
    ownerCandidateEmail: string | null;
  }[];
};
type OwnerPassword = { email: string; password: string };
const money = (minor: number) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(minor / 100) + ' сом';

export default function AdminPage() {
  const session = useSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [shopPage, setShopPage] = useState(1);
  const [shopTotal, setShopTotal] = useState<number | null>(null);
  const [shopItems, setShopItems] = useState<AdminOverview['shops'] | null>(
    null,
  );
  const [shopSearch, setShopSearch] = useState('');
  const [shopSort, setShopSort] = useState<'name' | 'city'>('name');
  const [shopRefresh, setShopRefresh] = useState(0);
  const [shopLoading, setShopLoading] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationTotal, setApplicationTotal] = useState(0);
  const [applicationQuery, setApplicationQuery] = useState('');
  const [applicationStatus, setApplicationStatus] = useState('');
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [productLoading, setProductLoading] = useState(true);
  const [productRefresh, setProductRefresh] = useState(0);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogItems, setAuditLogItems] = useState<Audit[] | null>(null);
  const [auditLogTotal, setAuditLogTotal] = useState<number | null>(null);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
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
  const [ownerPassword, setOwnerPassword] = useState<OwnerPassword | null>(
    null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockModalShopId, setBlockModalShopId] = useState<string | null>(null);
  const [blockModalReason, setBlockModalReason] = useState('');
  const [subModalShopId, setSubModalShopId] = useState<string | null>(null);
  const [subModalDate, setSubModalDate] = useState('');
  const [ownerSetupShop, setOwnerSetupShop] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[] | null>(null);
  const [heroSlidesLoading, setHeroSlidesLoading] = useState(false);
  const [heroSlidesSaving, setHeroSlidesSaving] = useState(false);
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
    setApplicationLoading(true);
    try {
      const [a, h, summary, g] = await Promise.all([
        api<Page<Application>>(
          `/platform/admin/applications?page=${applicationPage}&pageSize=${APPLICATIONS_PAGE_SIZE}&q=${encodeURIComponent(applicationQuery.trim())}&status=${encodeURIComponent(applicationStatus)}`,
        ),
        api<Page<Audit>>('/platform/admin/audit'),
        api<AdminOverview>('/platform/admin/overview'),
        api<{ items: PlatformFinancialGrant[] }>(
          '/platform/admin/financial-access',
        ).catch(() => ({ items: [] })),
      ]);
      setApplications(a.items);
      setApplicationTotal(a.total);
      const lastApplicationPage = Math.max(
        1,
        Math.ceil(a.total / APPLICATIONS_PAGE_SIZE),
      );
      if (applicationPage > lastApplicationPage)
        setApplicationPage(lastApplicationPage);
      setAudit(h.items);
      setOverview(summary);
      setGrants(g.items);
      setLoading(false);
    } finally {
      setApplicationLoading(false);
    }
  }
  useEffect(() => {
    if (!session.user?.platformAdmin) return;
    let active = true;
    setAuditLogLoading(true);
    void api<Page<Audit> & { page?: number }>(
      `/platform/admin/audit?page=${auditLogPage}&pageSize=${AUDIT_PAGE_SIZE}`,
    )
      .then((result) => {
        if (!active) return;
        setAuditLogItems(result.items);
        setAuditLogTotal(result.total);
        const lastPage = Math.max(1, Math.ceil(result.total / AUDIT_PAGE_SIZE));
        if (auditLogPage > lastPage) setAuditLogPage(lastPage);
      })
      .catch((error) => {
        if (active) setError(errorText(error));
      })
      .finally(() => {
        if (active) setAuditLogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.user?.userId, session.user?.platformAdmin, auditLogPage]);

  useEffect(() => {
    if (!session.user?.platformAdmin) return;
    let active = true;
    setShopLoading(true);
    const timer = window.setTimeout(
      () => {
        void api<
          Page<AdminOverview['shops'][number]> & {
            page?: number;
            pageSize?: number;
          }
        >(
          `/platform/admin/shops?page=${shopPage}&pageSize=${SHOPS_PAGE_SIZE}&q=${encodeURIComponent(shopSearch.trim())}&sort=${shopSort}`,
        )
          .then((result) => {
            if (!active) return;
            if (result.pageSize !== SHOPS_PAGE_SIZE || result.page !== shopPage)
              return;
            setShopItems(result.items);
            setShopTotal(result.total);
            const lastPage = Math.max(
              1,
              Math.ceil(result.total / SHOPS_PAGE_SIZE),
            );
            if (shopPage > lastPage) setShopPage(lastPage);
          })
          .catch((error) => {
            if (active) setError(errorText(error));
          })
          .finally(() => {
            if (active) setShopLoading(false);
          });
      },
      shopSearch.trim() ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    session.user?.userId,
    session.user?.platformAdmin,
    shopPage,
    shopSearch,
    shopSort,
    shopRefresh,
  ]);

  useEffect(() => {
    if (!session.user?.platformAdmin) return;
    let active = true;
    setProductLoading(true);
    const timer = window.setTimeout(
      () => {
        const query = search.trim();
        void api<Page<Product>>(
          `/platform/admin/products?page=${productPage}&pageSize=${PRODUCTS_PAGE_SIZE}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
        )
          .then((result) => {
            if (!active) return;
            setProducts(result.items);
            setProductTotal(result.total);
            const lastPage = Math.max(
              1,
              Math.ceil(result.total / PRODUCTS_PAGE_SIZE),
            );
            if (productPage > lastPage) setProductPage(lastPage);
          })
          .catch((e) => {
            if (active) setError(errorText(e));
          })
          .finally(() => {
            if (active) setProductLoading(false);
          });
      },
      search.trim() ? 250 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    session.user?.userId,
    session.user?.platformAdmin,
    productPage,
    search,
    productRefresh,
  ]);
  useEffect(() => {
    if (!session.user?.platformAdmin) return;
    void load().catch((e) => {
      setError(errorText(e));
      setLoading(false);
    });
  }, [
    session.user?.userId,
    applicationPage,
    applicationQuery,
    applicationStatus,
  ]);

  useEffect(() => {
    if (!session.user?.platformAdmin || tab !== 'banners') return;
    let active = true;
    setHeroSlidesLoading(true);
    void api<{ slides: HeroSlide[] }>('/platform/admin/hero-slides')
      .then((res) => {
        if (!active) return;
        setHeroSlides(res.slides);
      })
      .catch((err) => {
        if (!active) return;
        setError(errorText(err));
      })
      .finally(() => {
        if (!active) return;
        setHeroSlidesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.user?.userId, session.user?.platformAdmin, tab]);

  async function handleSaveHeroSlides(slides: HeroSlide[]) {
    setHeroSlidesSaving(true);
    try {
      const res = await api<{ slides: HeroSlide[] }>(
        '/platform/admin/hero-slides',
        {
          method: 'PUT',
          body: { slides },
        },
      );
      setHeroSlides(res.slides);
    } catch (err) {
      throw err;
    } finally {
      setHeroSlidesSaving(false);
    }
  }

  async function decideApplication(
    row: Application,
    decision: 'in_review' | 'approved' | 'rejected',
    credentialDelivery?: 'invite' | 'password',
  ) {
    setError('');
    setInvitation('');
    setGeneratedPassword('');
    setOwnerPassword(null);
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
    setSelected(null);
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
  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setSelected(null);
        setReason('');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selected, busy]);
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
      setProductRefresh((value) => value + 1);
    } catch (e) {
      setError(errorText(e));
      await load().catch(() => {});
      setProductRefresh((value) => value + 1);
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

  async function resetOwnerPassword(
    shopId: string,
    shopName: string,
    ownerEmail?: string,
  ) {
    if (
      !ownerEmail &&
      !window.confirm(
        `Сбросить пароль владельца магазина «${shopName}»? Текущий пароль перестанет работать.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setOwnerPassword(null);
    setGeneratedPassword('');
    setInvitation('');
    try {
      const result = await api<{
        email: string;
        temporaryPassword: string;
      }>(`/platform/admin/shops/${shopId}/reset-owner-password`, {
        method: 'POST',
        ...(ownerEmail ? { body: { ownerEmail: ownerEmail.trim() } } : {}),
      });
      setOwnerSetupShop(null);
      setOwnerPassword({
        email: result.email,
        password: result.temporaryPassword,
      });
      if (ownerEmail) void load().catch(() => {});
      setShopRefresh((value) => value + 1);
    } catch (e) {
      setError(
        e instanceof ApiError &&
          e.status === 409 &&
          e.message === 'An account with this email already exists'
          ? 'Учётная запись с этим email уже существует. Проверьте владельца магазина.'
          : errorText(e),
      );
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
  const visibleApps = applications;
  const visibleShops =
    shopItems ??
    (overview?.shops ?? []).filter((shop) =>
      [shop.name, shop.city ?? ''].some((value) =>
        value
          .toLocaleLowerCase('ru')
          .includes(shopSearch.trim().toLocaleLowerCase('ru')),
      ),
    );
  const visibleShopTotal = shopTotal ?? visibleShops.length;
  const visibleProducts = products;
  const productFirst = productTotal
    ? (productPage - 1) * PRODUCTS_PAGE_SIZE + 1
    : 0;
  const productLast = Math.min(productTotal, productPage * PRODUCTS_PAGE_SIZE);
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
      <div className="toolbar">
        <label>
          Поиск заявок
          <input
            value={applicationQuery}
            placeholder="Магазин или email"
            onChange={(event) => {
              setApplicationQuery(event.target.value);
              setApplicationPage(1);
            }}
          />
        </label>
        <label>
          Статус заявки
          <select
            value={applicationStatus}
            onChange={(event) => {
              setApplicationStatus(event.target.value);
              setApplicationPage(1);
            }}
          >
            <option value="">Все статусы</option>
            <option value="new">Новые</option>
            <option value="in_review">На проверке</option>
            <option value="approved">Одобрены</option>
            <option value="rejected">Отклонены</option>
          </select>
        </label>
        <span className="muted">Всего: {applicationTotal}</span>
      </div>
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
      <Pagination
        page={applicationPage}
        total={applicationTotal}
        size={APPLICATIONS_PAGE_SIZE}
        onPage={setApplicationPage}
        busy={applicationLoading}
        label="Страницы заявок партнёров"
      />
    </AdminCard>
  );

  const productsTable = (
    <AdminCard
      title="Модерация товаров"
      subtitle="Карточки магазинов на проверке"
      action={<button onClick={() => setTab('products')}>Все товары →</button>}
    >
      {productLoading ? (
        <p role="status">Загрузка товаров…</p>
      ) : !visibleProducts.length ? (
        <AdminEmpty>Нет карточек на проверке</AdminEmpty>
      ) : (
        <div className="admin-kit-scroll">
          <table className="admin-kit-table admin-kit-products-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Магазин</th>
                <th>Категория</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => (
                <tr key={p.revision_id}>
                  <td data-label="Товар">
                    <strong>{p.name}</strong>
                  </td>
                  <td data-label="Магазин">{p.shop_name}</td>
                  <td data-label="Категория">{p.category || 'Не указана'}</td>
                  <td data-label="Дата">{productDate(p.created_at)}</td>
                  <td data-label="Статус">
                    <AdminStatus>На проверке</AdminStatus>
                  </td>
                  <td data-label="Действие">
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
      {!productLoading && productTotal > 0 && (
        <div className="admin-kit-pagination">
          <span>
            Показано {productFirst}–{productLast} из {productTotal}
          </span>
          <Pagination
            page={productPage}
            total={productTotal}
            size={PRODUCTS_PAGE_SIZE}
            onPage={setProductPage}
            label="Страницы товаров на модерации"
          />
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
            onChange={(e) => {
              setSearch(e.target.value);
              setProductPage(1);
            }}
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
      {ownerPassword && (
        <AdminCard
          title="Новый пароль владельца"
          subtitle={`Передайте пароль владельцу ${ownerPassword.email} лично. Он показан только сейчас.`}
        >
          <input
            aria-label="Новый пароль владельца"
            readOnly
            value={ownerPassword.password}
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={() =>
              void navigator.clipboard
                .writeText(ownerPassword.password)
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
                  {ownerSetupShop && (
                    <form
                      className="panel form-panel"
                      style={{ marginBottom: '1rem' }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void resetOwnerPassword(
                          ownerSetupShop.id,
                          ownerSetupShop.name,
                          ownerSetupShop.email,
                        );
                      }}
                    >
                      <h3>Первый пароль владельца «{ownerSetupShop.name}»</h3>
                      <p className="muted">
                        Укажите email владельца. Пароль будет показан один раз,
                        передайте его лично.
                      </p>
                      <label>
                        Email владельца
                        <input
                          type="email"
                          required
                          value={ownerSetupShop.email}
                          onChange={(event) =>
                            setOwnerSetupShop({
                              ...ownerSetupShop,
                              email: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="admin-kit-actions">
                        <button
                          className="admin-kit-approve"
                          disabled={busy || !ownerSetupShop.email.trim()}
                        >
                          Создать владельца и выдать пароль
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setOwnerSetupShop(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    </form>
                  )}
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

                  <div className="toolbar">
                    <label>
                      Поиск магазинов
                      <input
                        value={shopSearch}
                        placeholder="Магазин или город"
                        onChange={(event) => {
                          setShopSearch(event.target.value);
                          setShopPage(1);
                          setShopItems(null);
                          setShopTotal(null);
                        }}
                      />
                    </label>
                    <label>
                      Сортировка магазинов
                      <select
                        value={shopSort}
                        onChange={(event) => {
                          setShopSort(event.target.value as 'name' | 'city');
                          setShopPage(1);
                          setShopItems(null);
                          setShopTotal(null);
                        }}
                      >
                        <option value="name">По названию</option>
                        <option value="city">По городу</option>
                      </select>
                    </label>
                    <span className="muted">Всего: {visibleShopTotal}</span>
                  </div>
                  {!visibleShops.length ? (
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
                          {visibleShops.map((shop) => (
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
                                  <button
                                    className="admin-kit-approve"
                                    disabled={busy}
                                    onClick={() => {
                                      if (shop.hasOwner)
                                        void resetOwnerPassword(
                                          shop.id,
                                          shop.name,
                                        );
                                      else
                                        setOwnerSetupShop({
                                          id: shop.id,
                                          name: shop.name,
                                          email: shop.ownerCandidateEmail ?? '',
                                        });
                                    }}
                                  >
                                    {shop.hasOwner
                                      ? 'Сбросить пароль владельца'
                                      : 'Выдать первый пароль владельцу'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Pagination
                    page={shopPage}
                    total={visibleShopTotal}
                    size={SHOPS_PAGE_SIZE}
                    onPage={setShopPage}
                    busy={shopLoading}
                    label="Страницы магазинов платформы"
                  />
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
            <>{productsTable}</>
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
          ) : tab === 'banners' ? (
            heroSlidesLoading && !heroSlides ? (
              <AdminCard
                title="Баннеры витрины"
                subtitle="Загрузка баннеров..."
              >
                <AdminEmpty>Загрузка слайдов...</AdminEmpty>
              </AdminCard>
            ) : (
              <HeroSliderEditor
                key={heroSlides ? 'loaded' : 'initial'}
                initialSlides={heroSlides || []}
                onSave={handleSaveHeroSlides}
                saving={heroSlidesSaving}
              />
            )
          ) : (
            <AdminCard
              title="Журнал решений"
              subtitle="История действий модерации"
            >
              {!(auditLogItems ?? audit).length ? (
                <AdminEmpty>Решений пока нет</AdminEmpty>
              ) : (
                <div className="admin-kit-activity">
                  {(auditLogItems ?? audit).map((event, index) => (
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
              <Pagination
                page={auditLogPage}
                total={auditLogTotal ?? audit.length}
                size={AUDIT_PAGE_SIZE}
                onPage={setAuditLogPage}
                busy={auditLogLoading}
                label="Страницы журнала решений"
              />
            </AdminCard>
          )}
        </>
      )}
      {selected &&
        createPortal(
          <div className="admin-kit-product-modal-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-moderation-title"
              className="admin-kit-product-modal"
            >
              <header className="admin-kit-product-modal-header">
                <div>
                  <h2 id="product-moderation-title">
                    Предложено: {selected.name}
                  </h2>
                  <p>{selected.shop_name}</p>
                </div>
                <button
                  type="button"
                  className="admin-kit-product-modal-close"
                  aria-label="Закрыть карточку"
                  disabled={busy}
                  autoFocus
                  onClick={() => {
                    setSelected(null);
                    setReason('');
                  }}
                >
                  ×
                </button>
              </header>
              <div className="admin-kit-product-modal-body">
                <div className="admin-kit-product-modal-photo">
                  {selected.has_photo ? (
                    <img
                      src={
                        '/api/platform/admin/products/revisions/' +
                        selected.revision_id +
                        '/photo'
                      }
                      alt={'Фото товара ' + selected.name}
                    />
                  ) : (
                    <span>Фото товара не добавлено</span>
                  )}
                </div>
                <div className="admin-kit-product-modal-info">
                  <dl>
                    <div>
                      <dt>Магазин</dt>
                      <dd>{selected.shop_name}</dd>
                    </div>
                    <div>
                      <dt>Категория</dt>
                      <dd>{selected.category || 'Не указана'}</dd>
                    </div>
                    <div>
                      <dt>Подкатегория</dt>
                      <dd>{selected.subcategory || 'Не указана'}</dd>
                    </div>
                    <div>
                      <dt>Дата заявки</dt>
                      <dd>{productDate(selected.created_at, true)}</dd>
                    </div>
                    <div>
                      <dt>Статус</dt>
                      <dd>
                        <AdminStatus>На проверке</AdminStatus>
                      </dd>
                    </div>
                  </dl>
                  <h3>Описание</h3>
                  <p className="admin-kit-product-modal-description">
                    {selected.description || 'Описание не добавлено'}
                  </p>
                </div>
              </div>
              {selected.has_publication && (
                <div className="admin-kit-product-modal-approved">
                  <h3>Сейчас опубликовано</h3>
                  <div>
                    {selected.approved_has_photo && (
                      <img
                        src={
                          '/api/platform/admin/products/revisions/' +
                          selected.revision_id +
                          '/photo?approved=true'
                        }
                        alt="Текущее фото на витрине"
                      />
                    )}
                    <p>
                      <strong>{selected.approved_name}</strong>
                      <span>
                        {selected.approved_category || 'Без категории'}
                      </span>
                      <span>
                        {selected.approved_description || 'Без описания'}
                      </span>
                    </p>
                  </div>
                </div>
              )}
              <footer className="admin-kit-product-modal-footer">
                <label className="admin-kit-reason">
                  Причина отклонения
                  <input
                    value={reason}
                    maxLength={500}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Обязательна при отклонении"
                  />
                </label>
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
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
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </WorkspaceShell>
  );
}
