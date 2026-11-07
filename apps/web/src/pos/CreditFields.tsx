import { useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from '../customers/kyrgyzPhoneMask';
import PosBuyerInvitation from './PosBuyerInvitation';
import './credit-fields.css';

type Customer = {
  id: string;
  name: string;
  phone: string;
  linked: boolean;
  creditApproved: boolean;
  creditLimitMinor: string | number;
};

export type CreditFieldsProps = {
  shopId: string;
  enabled: boolean;
  disabled: boolean;
  customerId: string;
  onCustomerChange: (id: string) => void;
  paid: string;
  onPaidChange: (value: string) => void;
  dueOn: string;
  onDueChange: (value: string) => void;
  debtMinor: number | null;
};

export default function CreditFields({
  shopId,
  enabled,
  disabled,
  customerId,
  onCustomerChange,
  paid,
  onPaidChange,
  dueOn,
  onDueChange,
  debtMinor,
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

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void api<{ items: Customer[] }>(
        `/shops/${shopId}/customers?page=1&pageSize=100&q=${encodeURIComponent(query)}`,
      )
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
  const eligible = (customer: Customer) =>
    customer.linked && customer.creditApproved;

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
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      // A new customer cannot be charged on credit until they accept the
      // invitation and the shop owner approves a separate credit limit.
      onCustomerChange('');
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

  if (!enabled) return null;

  return (
    <section className="pos-credit-fields credit-customer-flow">
      <div className="credit-customer-heading">
        <strong>Продажа в долг</strong>
        <span>Выберите покупателя или создайте нового</span>
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
          Существующий
        </button>
        <button
          type="button"
          className={mode === 'new' ? 'active' : ''}
          aria-pressed={mode === 'new'}
          disabled={disabled}
          onClick={() => setMode('new')}
        >
          + Новый клиент
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
              onChange={(event) => setQuery(event.target.value)}
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
              Покупателей не найдено. Вы можете создать клиента и выдать
              QR-приглашение.
            </p>
          )}
          <div
            className="credit-customer-list"
            role="group"
            aria-label="Покупатели магазина"
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
                onClick={() =>
                  onCustomerChange(eligible(customer) ? customer.id : '')
                }
              >
                <span className="credit-customer-avatar" aria-hidden="true">
                  {customer.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="credit-customer-details">
                  <strong>{customer.name}</strong>
                  <small>{customer.phone}</small>
                  <small
                    className={
                      eligible(customer)
                        ? 'credit-customer-ok'
                        : 'credit-customer-warning'
                    }
                  >
                    {!customer.linked
                      ? 'Кабинет не подтверждён'
                      : !customer.creditApproved
                        ? 'Кредит не разрешён владельцем'
                        : `Лимит: ${formatSom(Number(customer.creditLimitMinor))}`}
                  </small>
                </span>
                <span className="credit-customer-radio" aria-hidden="true">
                  {customerId === customer.id ? '✓' : ''}
                </span>
              </button>
            ))}
          </div>
          {selected && eligible(selected) && (
            <p
              className="credit-customer-note credit-customer-success"
              role="status"
            >
              Покупатель выбран. Доступный долг проверяется сервером при оплате.
            </p>
          )}
          <p className="credit-customer-note">
            Все покупатели магазина видны в списке. Для продажи в долг нужен
            подтверждённый кабинет и разрешение владельца.
          </p>
        </div>
      ) : (
        <div className="credit-customer-new">
          {!invitation && !verifiedEnrollment && (
            <form onSubmit={(event) => void addCustomer(event)}>
              <p className="credit-customer-note">
                Новый клиент получит приглашение в общий кабинет MyStore.
                Создание клиента само по себе не выдаёт кредит.
              </p>
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
                {busy ? 'Сохраняем…' : 'Создать и показать QR-приглашение'}
              </button>
            </form>
          )}
          {verifiedEnrollment && (
            <div
              className="credit-customer-note credit-customer-success"
              role="status"
            >
              <strong>{verifiedEnrollment}</strong> уже подтвердил номер в
              MyStore. Кабинет подключён автоматически, QR-приглашение не
              требуется. Владелец магазина должен отдельно разрешить кредит и
              установить лимит.
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
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
