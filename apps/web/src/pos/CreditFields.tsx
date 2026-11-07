import { useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from '../customers/kyrgyzPhoneMask';
import PosBuyerInvitation from './PosBuyerInvitation';
import PaymentIcon from './PaymentIcon';
import './credit-fields.css';

type Customer = {
  id: string | null;
  name: string;
  phone: string;
  linked: boolean;
  isLocal?: boolean;
  debtMinor?: string | number;
  balancePoints?: string | number;
};

export type CreditFieldsProps = {
  shopId: string;
  enabled: boolean;
  disabled: boolean;
  customerId: string;
  onCustomerChange: (id: string) => void;
  onCustomerEligible: (eligible: boolean) => void;
  paid: string;
  onPaidChange: (value: string) => void;
  dueOn: string;
  onDueChange: (value: string) => void;
  debtMinor: number | null;
  customerOnly?: boolean;
  selectionOnly?: boolean;
  selectedCustomerName?: string;
  onOpenCustomer?: () => void;
  onSelectedCustomer?: (customer: {
    id: string;
    name: string;
    phone: string;
    linked: boolean;
    debtMinor?: string | number;
    balancePoints?: string | number;
  }) => void;
};

export default function CreditFields({
  shopId,
  enabled,
  disabled,
  customerId,
  onCustomerChange,
  onCustomerEligible,
  paid,
  onPaidChange,
  dueOn,
  onDueChange,
  debtMinor,
  customerOnly = false,
  selectionOnly = false,
  selectedCustomerName = '',
  onOpenCustomer,
  onSelectedCustomer,
}: CreditFieldsProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState<{
    name: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [verifiedEnrollment, setVerifiedEnrollment] = useState('');
  const [existingInvitation, setExistingInvitation] = useState<{
    name: string;
    token: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const endpoint =
        query.trim().length >= 3
          ? `/shops/${shopId}/customers/directory?q=${encodeURIComponent(query)}`
          : `/shops/${shopId}/customers?page=1&pageSize=100&q=${encodeURIComponent(query)}`;
      void api<{ items: Customer[] }>(endpoint)
        .then((page) => {
          if (!active) return;
          setCustomers(page.items);
          setError('');
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [shopId, enabled, query, revision]);

  const selected = customers.find((customer) => customer.id === customerId);

  async function chooseCustomer(customer: Customer) {
    if (busy || disabled) return;
    setError('');
    setExistingInvitation(null);
    setBusy(true);
    try {
      const resolved = customer.id
        ? customer
        : await api<{
            id: string;
            name: string;
            phone: string;
            linked: boolean;
          }>(`/shops/${shopId}/customers/resolve`, {
            method: 'POST',
            body: { name: customer.name, phone: customer.phone },
          });
      if (!resolved.id) throw new Error('Не удалось выбрать покупателя.');
      onCustomerChange(resolved.id);
      onCustomerEligible(true);
      onSelectedCustomer?.({
        id: resolved.id,
        name: resolved.name,
        phone: resolved.phone,
        linked: resolved.linked,
      });
      setRevision((n) => n + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    setInvitation(null);
    setVerifiedEnrollment('');
    try {
      const customer = await api<{ id: string; name: string; linked: boolean }>(
        `/shops/${shopId}/customers`,
        {
          method: 'POST',
          body: {
            name: newName.trim() || 'Покупатель',
            phone: newPhone,
            address: newAddress,
          },
        },
      );
      const createdPhone = newPhone;
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      // Shop debt can be assigned without verifying the buyer portal account.
      onCustomerChange(customer.id);
      onCustomerEligible(true);
      onSelectedCustomer?.({
        id: customer.id,
        name: customer.name,
        phone: createdPhone,
        linked: customer.linked,
      });
      setRevision((n) => n + 1);
      if (customer.linked) {
        setVerifiedEnrollment(customer.name);
      } else {
        try {
          const issued = await api<{ token: string; expiresAt: string }>(
            `/shops/${shopId}/customers/${customer.id}/invite`,
            { method: 'POST', body: {} },
          );
          setInvitation({ ...issued, name: customer.name });
        } catch (err) {
          setError(
            'Клиент создан, но приглашение не выдано: ' + errorText(err),
          );
        }
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function inviteExisting(customer: Customer) {
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    setExistingInvitation(null);
    try {
      const result = await api<{ token: string; expiresAt: string }>(
        `/shops/${shopId}/customers/${customer.id}/invite`,
        { method: 'POST', body: {} },
      );
      setExistingInvitation({ ...result, name: customer.name });
    } catch (err) {
      setError(errorText(err));
      setRevision((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  if (selectionOnly) {
    return (
      <section className="pos-credit-fields credit-customer-flow">
        <div className="credit-customer-balance">
          <span>
            <PaymentIcon name="user" size={19} /> Покупатель
          </span>
          <strong>
            {customerId ? selectedCustomerName || 'Выбран' : 'Не выбран'}
          </strong>
        </div>
        <button
          type="button"
          className="credit-customer-invite-button"
          disabled={disabled}
          onClick={onOpenCustomer}
        >
          <PaymentIcon name="user" size={18} />
          {customerId ? 'Изменить покупателя' : 'Выбрать покупателя'}
        </button>
        <div className="credit-customer-payment">
          <label>
            Оплачено сейчас, сом
            <input
              inputMode="decimal"
              value={paid}
              disabled={disabled}
              onChange={(event) => onPaidChange(event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Вернуть до
            <input
              type="date"
              value={dueOn}
              disabled={disabled}
              required
              onChange={(event) => onDueChange(event.target.value)}
            />
          </label>
        </div>
        <div className="credit-customer-balance">
          <span>Остаток в долг</span>
          <strong>
            {debtMinor === null ? 'Проверьте сумму' : formatSom(debtMinor)}
          </strong>
        </div>
      </section>
    );
  }

  return (
    <section className="pos-credit-fields credit-customer-flow">
      <div className="credit-customer-heading">
        <strong>Покупатель</strong>
      </div>

      <div
        className="credit-customer-tabs"
        role="group"
        aria-label="Тип покупателя"
      >
        <button
          type="button"
          className={mode === 'existing' ? 'active' : ''}
          aria-pressed={mode === 'existing'}
          disabled={disabled}
          onClick={() => setMode('existing')}
        >
          <PaymentIcon name="user" size={17} />
          {customerOnly ? 'Найти клиента' : 'Существующий'}
        </button>
        <button
          type="button"
          className={mode === 'new' ? 'active' : ''}
          aria-pressed={mode === 'new'}
          disabled={disabled}
          onClick={() => {
            setMode('new');
            onCustomerChange('');
            onCustomerEligible(false);
          }}
        >
          <PaymentIcon name="user-plus" size={17} />
          Новый клиент
        </button>
      </div>

      {mode === 'existing' ? (
        <div className="credit-customer-search">
          <label>
            Найти покупателя
            <input
              type="search"
              value={query}
              disabled={disabled}
              onChange={(event) => {
                setQuery(event.target.value);
                setExistingInvitation(null);
                onCustomerChange('');
                onCustomerEligible(false);
              }}
              placeholder="Имя или +996…"
              autoComplete="off"
            />
          </label>
          {loading && (
            <p className="muted" role="status">
              Ищем покупателей…
            </p>
          )}
          {!loading && customers.length === 0 && (
            <p className="credit-customer-note">
              Покупатели не найдены. Нажмите «+ Новый клиент».
            </p>
          )}
          <div
            className="credit-customer-list"
            role="group"
            aria-label="Найденные покупатели"
          >
            {customers.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className={
                  customerId === customer.id
                    ? 'credit-customer-item selected'
                    : 'credit-customer-item'
                }
                disabled={disabled}
                aria-pressed={customerId === customer.id}
                onClick={() => void chooseCustomer(customer)}
              >
                <span className="credit-customer-avatar" aria-hidden="true">
                  {customer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="credit-customer-details">
                  <strong>{customer.name}</strong>
                  <small>{customer.phone}</small>
                  {(Number(customer.debtMinor) > 0 || Number(customer.balancePoints) > 0) && (
                    <span className="credit-customer-badges">
                      {Number(customer.debtMinor) > 0 && (
                        <span className="credit-customer-debt"><PaymentIcon name="coins" size={13} /> Долг: {formatSom(Number(customer.debtMinor))}</span>
                      )}
                      {Number(customer.balancePoints) > 0 && (
                        <span className="credit-customer-points"><PaymentIcon name="gift" size={13} /> Бонусы: {Number(customer.balancePoints)}</span>
                      )}
                    </span>
                  )}
                  <small
                    className={customer.linked ? 'credit-customer-ok' : ''}
                  >
                    {customer.linked
                      ? 'Кабинет подтверждён'
                      : customer.isLocal === false
                        ? 'Из общего каталога покупателей'
                        : 'Кабинет не подтверждён'}
                  </small>
                </span>
                <span className="credit-customer-radio" aria-hidden="true">
                  {customerId === customer.id ? (
                    <PaymentIcon name="check" size={16} />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          {selected && !selected.linked && !existingInvitation && (
            <button
              type="button"
              className="credit-customer-invite-button"
              disabled={disabled || busy}
              onClick={() => void inviteExisting(selected)}
            >
              <PaymentIcon name="qr" size={17} />
              {busy ? 'Создаём приглашение…' : 'Выдать QR-приглашение'}
            </button>
          )}
          {existingInvitation && (
            <PosBuyerInvitation
              name={existingInvitation.name}
              token={existingInvitation.token}
              expiresAt={existingInvitation.expiresAt}
              onClose={() => {
                setExistingInvitation(null);
                setRevision((n) => n + 1);
              }}
            />
          )}
        </div>
      ) : (
        <div className="credit-customer-new">
          {!invitation && !verifiedEnrollment && (
            <form onSubmit={(event) => void addCustomer(event)}>
              <label>
                Имя покупателя
                <input
                  minLength={2}
                  maxLength={120}
                  value={newName}
                  disabled={disabled || busy}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Азамат"
                />
              </label>
              <label>
                Номер телефона
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  pattern={KYRGYZ_PHONE_PATTERN}
                  maxLength={32}
                  value={newPhone}
                  disabled={disabled || busy}
                  onChange={(event) =>
                    setNewPhone(formatKyrgyzPhoneInput(event.target.value))
                  }
                  placeholder="+996 700 123 456"
                />
              </label>
              <label>
                Адрес <span className="muted">(необязательно)</span>
                <input
                  maxLength={500}
                  value={newAddress}
                  disabled={disabled || busy}
                  onChange={(event) => setNewAddress(event.target.value)}
                  placeholder="Введите адрес"
                />
              </label>
              <button
                className="primary credit-customer-create"
                type="submit"
                disabled={busy || disabled}
              >
                <PaymentIcon name="qr" size={17} />
                {busy ? 'Сохраняем…' : 'Создать и показать QR-приглашение'}
              </button>
            </form>
          )}
          {verifiedEnrollment && (
            <div
              className="credit-customer-note credit-customer-success"
              role="status"
            >
              <strong>{verifiedEnrollment}</strong> — покупатель создан и выбран
              для продажи. Кабинет уже подтверждён, QR-приглашение не требуется.
              <button
                type="button"
                onClick={() => {
                  setVerifiedEnrollment('');
                  setMode('existing');
                  setQuery('');
                }}
              >
                К списку покупателей
              </button>
            </div>
          )}
          {invitation && (
            <PosBuyerInvitation
              name={invitation.name}
              token={invitation.token}
              expiresAt={invitation.expiresAt}
              onClose={() => {
                setInvitation(null);
                setMode('existing');
                setQuery('');
              }}
            />
          )}
        </div>
      )}

      {!customerOnly && (
        <div className="credit-customer-payment">
          <label>
            Оплачено сейчас, сом
            <input
              inputMode="decimal"
              value={paid}
              disabled={disabled}
              onChange={(event) => onPaidChange(event.target.value)}
              placeholder="0"
            />
          </label>
          <label>
            Вернуть до
            <input
              type="date"
              value={dueOn}
              disabled={disabled}
              required
              onChange={(event) => onDueChange(event.target.value)}
            />
          </label>
        </div>
      )}
      {!customerOnly && (
        <div className="credit-customer-balance">
          <span>Остаток в долг</span>
          <strong>
            {debtMinor === null ? 'Проверьте сумму' : formatSom(debtMinor)}
          </strong>
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
