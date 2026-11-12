import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import Pagination from '../components/Pagination';
import { AdminMetric } from '../platform/AdminKit';
import { useCurrentShift } from '../pos/use-current-shift';
import BuyerActivationPanel from './BuyerActivationPanel';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from './kyrgyzPhoneMask';

export type ShopCustomer = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  linked?: boolean;
  debtMinor?: number | string;
  balancePoints?: number;
  creditApproved?: boolean;
  creditLimitMinor?: number;
};

type CustomerSummary = {
  totalCustomers: number;
  debtorsCount: number;
  totalDebtMinor: number;
  linkedCount: number;
};

type CreditSale = {
  saleId: string;
  totalMinor: number;
  paidMinor: number;
  debtMinor: number;
  dueOn: string;
  createdAt: string;
};

type Repayment = {
  id: string;
  amountMinor: number;
  method: 'cash' | 'card';
  createdAt: string;
};

type Page = {
  items: ShopCustomer[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 10;

function initials(name: string, phone: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (name.trim().length >= 2) {
    return name.trim().slice(0, 2).toUpperCase();
  }
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-2) || 'КЛ';
}

export default function ShopCustomersPage({
  initialTab,
}: {
  initialTab?: 'all' | 'debt' | 'linked';
}) {
  const { shopId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = (searchParams.get('tab') || initialTab || 'all') as
    'all' | 'debt' | 'linked';
  const [tab, setTab] = useState<'all' | 'debt' | 'linked'>(tabParam);
  const [sort, setSort] = useState<'debt' | 'created' | 'name'>(
    tabParam === 'debt' ? 'debt' : 'created',
  );

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [summary, setSummary] = useState<CustomerSummary>({
    totalCustomers: 0,
    debtorsCount: 0,
    totalDebtMinor: 0,
    linkedCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  // Add customer modal / panel
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  // Buyer activation QR / password reset panel
  const [invitation, setInvitation] = useState<{
    customerId: string;
    token: string;
    expiresAt: string;
    name: string;
  } | null>(null);

  // Debt & Repayment Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<ShopCustomer | null>(
    null,
  );
  const [sales, setSales] = useState<CreditSale[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [salesLoading, setSalesLoading] = useState(false);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'cash' | 'card'>('cash');
  const [repayPending, setRepayPending] = useState(false);
  const [repayError, setRepayError] = useState('');
  const [repaySuccess, setRepaySuccess] = useState('');

  const retry = useRef<{
    saleId: string;
    amountMinor: number;
    method: 'cash' | 'card';
    shiftId: string;
    key: string;
  } | null>(null);

  const shift = useCurrentShift(shopId, String(revision));
  const activeShift =
    shift.current && !('occupied' in shift.current) ? shift.current : null;

  // Sync tab with URL
  const handleTabChange = (nextTab: 'all' | 'debt' | 'linked') => {
    setTab(nextTab);
    setPage(1);
    if (nextTab === 'debt') {
      setSort('debt');
    }
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === 'all') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  // Load KPI summary
  const loadSummary = useCallback(async () => {
    if (!shopId) return;
    try {
      const res = await api<CustomerSummary>(
        `/shops/${shopId}/customers/summary`,
      );
      setSummary(res);
    } catch {
      // Summary endpoint non-blocking fallback
    }
  }, [shopId, revision]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Load Customers list
  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError('');
    try {
      const filterArg = tab === 'all' ? '' : tab;
      const result = await api<Page>(
        `/shops/${shopId}/customers?page=${page}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(
          query,
        )}&filter=${filterArg}&sort=${sort}`,
      );
      setData(result);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [shopId, query, page, tab, sort, revision]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Load sales when customer is selected for debt drawer
  const loadCustomerSales = useCallback(
    async (customerId: string) => {
      if (!shopId || !customerId) return;
      setSalesLoading(true);
      setRepayError('');
      try {
        const rows = await api<CreditSale[]>(
          `/shops/${shopId}/pos/credit-sales?customerId=${customerId}`,
        );
        setSales(rows);
        const firstUnpaid = rows.find((s) => s.debtMinor > 0);
        setSelectedSaleId(
          firstUnpaid ? firstUnpaid.saleId : rows[0]?.saleId || '',
        );
      } catch (err) {
        setRepayError(errorText(err));
      } finally {
        setSalesLoading(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    if (selectedCustomer) {
      void loadCustomerSales(selectedCustomer.id);
    } else {
      setSales([]);
      setSelectedSaleId('');
      setRepayments([]);
    }
  }, [selectedCustomer, loadCustomerSales, revision]);

  // Load repayments when a sale is selected
  useEffect(() => {
    if (!selectedSaleId || !shopId) {
      setRepayments([]);
      return;
    }
    let live = true;
    void api<Repayment[]>(
      `/shops/${shopId}/pos/credit-sales/${selectedSaleId}/repayments`,
    )
      .then((rows) => {
        if (live) setRepayments(rows);
      })
      .catch((err) => {
        if (live) setRepayError(errorText(err));
      });
    return () => {
      live = false;
    };
  }, [shopId, selectedSaleId, revision]);

  const activeSale = sales.find((s) => s.saleId === selectedSaleId);
  const totalCustomerDebtMinor = sales.reduce((sum, s) => sum + s.debtMinor, 0);

  // Quick repayment
  async function submitRepayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeShift || !activeSale || repayPending) return;

    let amountMinor: number;
    try {
      amountMinor = parseSom(repayAmount);
    } catch {
      setRepayError('Введите корректную сумму погашения.');
      return;
    }

    if (!amountMinor || amountMinor > activeSale.debtMinor) {
      setRepayError(
        'Сумма должна быть положительной и не больше остатка долга.',
      );
      return;
    }

    const input = {
      saleId: activeSale.saleId,
      shiftId: activeShift.id,
      method: repayMethod,
      amountMinor,
    };

    if (
      retry.current &&
      (retry.current.saleId !== input.saleId ||
        retry.current.shiftId !== input.shiftId ||
        retry.current.method !== input.method ||
        retry.current.amountMinor !== input.amountMinor)
    ) {
      setRepayError(
        'После неопределённого результата повторите тот же платёж без изменений.',
      );
      return;
    }

    const key = retry.current?.key ?? crypto.randomUUID();
    retry.current = { ...input, key };
    setRepayPending(true);
    setRepayError('');
    setRepaySuccess('');

    try {
      const res = await api<{ debtMinor: number }>(
        `/shops/${shopId}/pos/credit-sales/${activeSale.saleId}/repayments`,
        {
          method: 'POST',
          key,
          body: {
            shiftId: activeShift.id,
            method: repayMethod,
            amountMinor,
          },
        },
      );
      retry.current = null;
      setRepayAmount('');
      setRepaySuccess(
        `Платёж принят! Остаток по продаже: ${formatSom(res.debtMinor)}`,
      );
      setRevision((v) => v + 1);
    } catch (err) {
      setRepayError(errorText(err));
    } finally {
      setRepayPending(false);
    }
  }

  // Create customer
  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    setCreateError('');
    try {
      const customer = await api<{ id: string; name: string }>(
        `/shops/${shopId}/customers`,
        {
          method: 'POST',
          body: { name: name.trim() || 'Покупатель', phone, address },
        },
      );
      setName('');
      setPhone('');
      setAddress('');
      setShowAddModal(false);
      setPage(1);
      setRevision((v) => v + 1);

      // Immediately issue QR invite
      try {
        const issued = await api<{ token: string; expiresAt: string }>(
          `/shops/${shopId}/customers/${customer.id}/invite`,
          { method: 'POST', body: {} },
        );
        setInvitation({
          ...issued,
          customerId: customer.id,
          name: customer.name,
        });
      } catch {
        // Invite optional
      }
    } catch (err) {
      setCreateError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  // Invite customer
  async function invite(customer: ShopCustomer) {
    if (!shopId) return;
    setError('');
    setInvitation(null);
    try {
      const issued = await api<{ token: string; expiresAt: string }>(
        `/shops/${shopId}/customers/${customer.id}/invite`,
        { method: 'POST', body: {} },
      );
      setInvitation({
        ...issued,
        customerId: customer.id,
        name: customer.name,
      });
    } catch (err) {
      setError(errorText(err));
    }
  }

  // Reset access QR
  async function resetAccess(customer: ShopCustomer) {
    if (!shopId) return;
    setError('');
    setInvitation(null);
    try {
      const issued = await api<{ token: string; expiresAt: string }>(
        `/shops/${shopId}/customers/${customer.id}/invite/reset`,
        { method: 'POST', body: {} },
      );
      setInvitation({
        ...issued,
        customerId: customer.id,
        name: customer.name,
      });
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="customer-page crm-hub">
      {/* Page Header */}
      <div className="page-heading crm-heading">
        <div>
          <p className="eyebrow">MyStore · CRM и взаиморасчёты</p>
          <h1>Клиенты и долги</h1>
          <p className="muted">
            Единый реестр покупателей магазина, контроль кредитных остатков и
            приём погашений в кассу.
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="primary crm-add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + Новый клиент
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="admin-kit-metrics crm-metrics">
        <AdminMetric
          symbol="◆"
          tone={summary.totalDebtMinor > 0 ? 'amber' : 'green'}
          label="Общий долг магазину"
          value={formatSom(summary.totalDebtMinor)}
          note={
            summary.debtorsCount > 0
              ? `${summary.debtorsCount} клиентов с долгом`
              : 'Все долги закрыты'
          }
        />
        <AdminMetric
          symbol="⚠"
          tone={summary.debtorsCount > 0 ? 'amber' : 'green'}
          label="Должники"
          value={String(summary.debtorsCount)}
          note={
            summary.totalCustomers > 0
              ? `${Math.round(
                  (summary.debtorsCount / summary.totalCustomers) * 100,
                )}% от базы клиентов`
              : 'Нет должников'
          }
        />
        <AdminMetric
          symbol="👥"
          tone="blue"
          label="Всего клиентов"
          value={String(summary.totalCustomers)}
          note="В базе магазина"
        />
        <AdminMetric
          symbol="✓"
          tone="green"
          label="Подключены к кабинету"
          value={String(summary.linkedCount)}
          note="Используют кабинет покупателя"
        />
      </div>

      {/* Invitation Modal / Panel */}
      {invitation && (
        <div className="crm-modal-backdrop" onClick={() => setInvitation(null)}>
          <div
            className="crm-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <BuyerActivationPanel
              name={invitation.name}
              token={invitation.token}
              expiresAt={invitation.expiresAt}
              shopId={shopId}
              customerId={invitation.customerId}
              onActivated={() => {
                setInvitation(null);
                setRevision((v) => v + 1);
              }}
              onClose={() => setInvitation(null)}
            />
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div
          className="crm-modal-backdrop"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="crm-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="crm-modal-head">
              <h2>Добавить нового клиента</h2>
              <button
                type="button"
                className="crm-modal-close"
                onClick={() => setShowAddModal(false)}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <p
              className="muted"
              style={{ marginTop: '-4px', marginBottom: '16px' }}
            >
              Контакты сохраняются только для этого магазина. После добавления
              вы сможете показать покупателю QR-код для входа.
            </p>
            <form onSubmit={(e) => void handleCreate(e)}>
              <div className="crm-form-fields">
                <label>
                  Имя покупателя
                  <input
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например, Азамат"
                    autoFocus
                  />
                </label>
                <label>
                  Номер телефона Кыргызстана
                  <input
                    required
                    type="tel"
                    maxLength={32}
                    autoComplete="tel"
                    pattern={KYRGYZ_PHONE_PATTERN}
                    title="Номер Кыргызстана: +996 700 123 456"
                    value={phone}
                    onChange={(e) =>
                      setPhone(formatKyrgyzPhoneInput(e.target.value))
                    }
                    placeholder="+996 700 123 456"
                  />
                </label>
                <label>
                  Адрес (необязательно)
                  <input
                    maxLength={500}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ош, улица Ленина…"
                  />
                </label>
              </div>
              {createError && (
                <p role="alert" className="error" style={{ marginTop: '12px' }}>
                  {createError}
                </p>
              )}
              <div className="crm-modal-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                >
                  Отмена
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? 'Сохраняем…' : 'Добавить и выдать QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main CRM Workspace Panel */}
      <section className="panel crm-table-panel">
        {/* Filter bar & Search */}
        <div className="crm-toolbar">
          <div className="crm-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'all'}
              className={`crm-tab ${tab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              Все клиенты
              <span className="crm-tab-badge">{summary.totalCustomers}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'debt'}
              className={`crm-tab ${tab === 'debt' ? 'active' : ''}`}
              onClick={() => handleTabChange('debt')}
            >
              С долгом
              <span
                className={`crm-tab-badge ${
                  summary.debtorsCount > 0 ? 'amber' : ''
                }`}
              >
                {summary.debtorsCount}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'linked'}
              className={`crm-tab ${tab === 'linked' ? 'active' : ''}`}
              onClick={() => handleTabChange('linked')}
            >
              Личный кабинет
              <span className="crm-tab-badge">{summary.linkedCount}</span>
            </button>
          </div>

          <div className="crm-filter-actions">
            <div className="crm-search-box">
              <span className="crm-search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Поиск по имени, номеру +996… или адресу"
              />
            </div>
            <select
              className="crm-sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'debt' | 'created' | 'name');
                setPage(1);
              }}
              aria-label="Сортировка списка"
            >
              <option value="debt">По долгу (сначала крупные)</option>
              <option value="created">Сначала новые</option>
              <option value="name">По имени (А–Я)</option>
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="error" style={{ margin: '16px' }}>
            {error}
          </p>
        )}

        {/* Customer Table */}
        {loading ? (
          <p role="status" className="crm-loading">
            Загрузка списка клиентов…
          </p>
        ) : (
          data && (
            <>
              <div className="table-wrap crm-table-wrap">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Клиент</th>
                      <th>Телефон</th>
                      <th>Бонусы</th>
                      <th>Задолженность</th>
                      <th>Кабинет</th>
                      <th style={{ textAlign: 'right' }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((c) => {
                      const debt = Number(c.debtMinor || 0);
                      return (
                        <tr
                          key={c.id}
                          className={debt > 0 ? 'crm-row-debtor' : ''}
                        >
                          <td>
                            <div className="crm-customer-cell">
                              <span
                                className={`crm-avatar ${
                                  debt > 0 ? 'debt-avatar' : ''
                                }`}
                                aria-hidden="true"
                              >
                                {initials(c.name, c.phone)}
                              </span>
                              <div className="crm-customer-meta">
                                <strong>{c.name}</strong>
                                {c.address && (
                                  <small className="crm-address">
                                    {c.address}
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="crm-phone">{c.phone}</span>
                          </td>
                          <td>
                            {c.balancePoints && c.balancePoints > 0 ? (
                              <span className="crm-points-badge">
                                ★ {c.balancePoints} б.
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            {debt > 0 ? (
                              <div className="crm-debt-cell">
                                <span className="crm-debt-badge warning">
                                  <strong>{formatSom(debt)}</strong>
                                </span>
                              </div>
                            ) : (
                              <span className="crm-debt-badge paid">
                                Нет долга
                              </span>
                            )}
                          </td>
                          <td>
                            {c.linked ? (
                              <div className="crm-cabinet-linked">
                                <span className="crm-badge-active">
                                  ✓ Активен
                                </span>
                                <button
                                  type="button"
                                  className="button ghost crm-btn-xs"
                                  onClick={() => void resetAccess(c)}
                                  title="Выдать QR для сброса пароля или быстрого входа"
                                >
                                  Сбросить пароль (QR)
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="button ghost crm-btn-xs"
                                onClick={() => void invite(c)}
                              >
                                Выдать QR
                              </button>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className={
                                debt > 0
                                  ? 'primary crm-btn-sm'
                                  : 'ghost crm-btn-sm'
                              }
                              onClick={() => {
                                setSelectedCustomer(c);
                                setRepayError('');
                                setRepaySuccess('');
                                setRepayAmount('');
                              }}
                            >
                              {debt > 0 ? 'Погасить долг' : 'История'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!data.items.length && (
                <div className="crm-empty-state">
                  <p className="muted">
                    {tab === 'debt'
                      ? 'Клиентов с активной задолженностью не найдено.'
                      : tab === 'linked'
                        ? 'Пока нет клиентов с привязанным кабинетом.'
                        : 'Клиенты не найдены.'}
                  </p>
                </div>
              )}

              <Pagination
                page={data.page}
                size={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            </>
          )
        )}
      </section>

      {/* Customer Debt & Repayments Drawer / Modal */}
      {selectedCustomer && (
        <div
          className="crm-modal-backdrop"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="crm-drawer-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="crm-drawer-head">
              <div>
                <p className="eyebrow" style={{ marginBottom: '2px' }}>
                  Взаиморасчёты с клиентом
                </p>
                <h2>{selectedCustomer.name}</h2>
                <span className="crm-phone">{selectedCustomer.phone}</span>
              </div>
              <button
                type="button"
                className="crm-modal-close"
                onClick={() => setSelectedCustomer(null)}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {/* Total Balance Banner */}
            <div
              className={`crm-balance-hero ${
                totalCustomerDebtMinor > 0 ? 'has-debt' : 'cleared'
              }`}
            >
              <div>
                <small>Остаток задолженности</small>
                <h3>{formatSom(totalCustomerDebtMinor)}</h3>
              </div>
              {totalCustomerDebtMinor > 0 ? (
                <span className="crm-hero-tag amber">Есть задолженность</span>
              ) : (
                <span className="crm-hero-tag green">Все долги закрыты</span>
              )}
            </div>

            {/* Repayment Form Section */}
            {totalCustomerDebtMinor > 0 && activeSale && (
              <section className="crm-repay-panel">
                <h3>Принять погашение в кассу</h3>
                {!activeShift ? (
                  <p role="alert" className="notice warning crm-notice">
                    Для приёма платежа необходимо открыть свою кассовую смену.{' '}
                    <Link to={`/seller/${shopId}/shift`}>
                      Перейти к открытию смены →
                    </Link>
                  </p>
                ) : (
                  <form onSubmit={(e) => void submitRepayment(e)}>
                    {sales.length > 1 && (
                      <label className="crm-field-block">
                        Выберите покупку для погашения:
                        <select
                          value={selectedSaleId}
                          onChange={(e) => {
                            setSelectedSaleId(e.target.value);
                            retry.current = null;
                            setRepayError('');
                            setRepaySuccess('');
                          }}
                        >
                          {sales.map((s) => (
                            <option key={s.saleId} value={s.saleId}>
                              Продажа от{' '}
                              {new Date(s.createdAt).toLocaleDateString(
                                'ru-KG',
                              )}{' '}
                              · Долг: {formatSom(s.debtMinor)} (Срок: {s.dueOn})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className="crm-sale-summary-pill">
                      <span>
                        Остаток по выбранной продаже:{' '}
                        <strong>{formatSom(activeSale.debtMinor)}</strong>
                      </span>
                    </div>

                    {/* Quick amount chips */}
                    <div className="crm-quick-chips">
                      <button
                        type="button"
                        className="crm-chip"
                        onClick={() =>
                          setRepayAmount(String(activeSale.debtMinor / 100))
                        }
                      >
                        Весь остаток ({formatSom(activeSale.debtMinor)})
                      </button>
                      {[500, 1000, 2000, 5000].map((som) => {
                        const minor = som * 100;
                        if (minor >= activeSale.debtMinor) return null;
                        return (
                          <button
                            key={som}
                            type="button"
                            className="crm-chip"
                            onClick={() => setRepayAmount(String(som))}
                          >
                            {som} сом
                          </button>
                        );
                      })}
                    </div>

                    <div className="crm-repay-grid">
                      <label>
                        Сумма к оплате, сом
                        <input
                          inputMode="decimal"
                          value={repayAmount}
                          disabled={repayPending || !activeShift}
                          onChange={(e) => setRepayAmount(e.target.value)}
                          placeholder="Например, 500"
                          required
                        />
                      </label>
                      <label>
                        Способ оплаты
                        <select
                          value={repayMethod}
                          disabled={repayPending || !activeShift}
                          onChange={(e) =>
                            setRepayMethod(e.target.value as 'cash' | 'card')
                          }
                        >
                          <option value="cash">💵 Наличные</option>
                          <option value="card">💳 Карта</option>
                        </select>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="primary crm-submit-repay"
                      disabled={
                        repayPending ||
                        !activeShift ||
                        !activeSale.debtMinor ||
                        !repayAmount
                      }
                    >
                      {repayPending ? 'Проводим…' : 'Принять погашение'}
                    </button>
                  </form>
                )}

                {repaySuccess && (
                  <p role="status" className="notice success crm-notice">
                    {repaySuccess}
                  </p>
                )}
                {repayError && (
                  <p role="alert" className="error crm-notice">
                    {repayError}
                  </p>
                )}
              </section>
            )}

            {/* Sales with credit history */}
            <div className="crm-history-block">
              <h3>История покупок в долг</h3>
              {salesLoading ? (
                <p className="muted">Загрузка покупок…</p>
              ) : !sales.length ? (
                <p className="muted">Покупок под реализацию нет.</p>
              ) : (
                <div className="table-wrap">
                  <table className="crm-subtable">
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Сумма</th>
                        <th>Оплачено</th>
                        <th>Остаток долга</th>
                        <th>Срок</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => (
                        <tr
                          key={sale.saleId}
                          className={
                            sale.saleId === selectedSaleId
                              ? 'crm-subrow-active'
                              : ''
                          }
                          onClick={() => setSelectedSaleId(sale.saleId)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            {new Date(sale.createdAt).toLocaleDateString(
                              'ru-KG',
                            )}
                          </td>
                          <td>{formatSom(sale.totalMinor)}</td>
                          <td>{formatSom(sale.paidMinor)}</td>
                          <td>
                            <strong>{formatSom(sale.debtMinor)}</strong>
                          </td>
                          <td>{sale.dueOn}</td>
                          <td>
                            {sale.debtMinor === 0 ? (
                              <span className="badge green">Погашен</span>
                            ) : (
                              <span className="badge amber">Не погашен</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Repayments History */}
            {selectedSaleId && (
              <div className="crm-history-block">
                <h3>История платежей по выбранной продаже</h3>
                {!repayments.length ? (
                  <p className="muted">Платежей пока не было.</p>
                ) : (
                  <div className="crm-repayment-list">
                    {repayments.map((p) => (
                      <div key={p.id} className="crm-repayment-item">
                        <div>
                          <strong>{formatSom(p.amountMinor)}</strong>
                          <span className="crm-method-tag">
                            {p.method === 'cash' ? 'Наличные' : 'Карта'}
                          </span>
                        </div>
                        <small className="muted">
                          {new Date(p.createdAt).toLocaleString('ru-KG')}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
