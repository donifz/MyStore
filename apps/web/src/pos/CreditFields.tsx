import { useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from '../customers/kyrgyzPhoneMask';
import BuyerActivationPanel from '../customers/BuyerActivationPanel';

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
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [invitation, setInvitation] = useState<{
    name: string;
    token: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api<{ items: Customer[] }>(
        `/shops/${shopId}/customers?page=1&pageSize=100&q=${encodeURIComponent(q)}`,
      )
        .then((page) => {
          if (active) {
            setCustomers(
              page.items.filter((c) => c.linked && c.creditApproved),
            );
            setError('');
          }
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [shopId, enabled, q]);

  async function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    setInvitation(null);
    try {
      const customer = await api<{ id: string; name: string }>(
        `/shops/${shopId}/customers`,
        {
          method: 'POST',
          body: { name: newName.trim(), phone: newPhone, address: newAddress },
        },
      );
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      setAdding(false);
      setQ(customer.name);
      try {
        const issued = await api<{ token: string; expiresAt: string }>(
          `/shops/${shopId}/customers/${customer.id}/invite`,
          { method: 'POST', body: {} },
        );
        setInvitation({ ...issued, name: customer.name });
      } catch (err) {
        setError('Клиент создан, но приглашение не выдано: ' + errorText(err));
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null;

  return (
    <div className="pos-credit-fields">
      <p className="muted">
        Клиент должен привязать кабинет, а владелец — разрешить кредит и
        установить лимит.
      </p>
      <label>
        Поиск покупателя по имени или номеру
        <input
          type="search"
          value={q}
          disabled={disabled}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Имя или +996…"
        />
      </label>
      <label>
        Покупатель
        <select
          value={customerId}
          disabled={disabled}
          required
          onChange={(event) => onCustomerChange(event.target.value)}
        >
          <option value="">Выберите клиента</option>
          {customers.map((customer) => (
            <option value={customer.id} key={customer.id}>
              {customer.name} · {customer.phone} · лимит{' '}
              {formatSom(Number(customer.creditLimitMinor))}
            </option>
          ))}
        </select>
      </label>
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
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setAdding((value) => !value);
          setInvitation(null);
        }}
      >
        {adding ? 'Отмена' : '+ Добавить покупателя по номеру'}
      </button>
      {adding && (
        <form
          className="pos-credit-enrollment"
          onSubmit={(event) => void addCustomer(event)}
        >
          <label>
            Имя покупателя
            <input
              required
              minLength={2}
              maxLength={120}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Азамат"
            />
          </label>
          <label>
            Номер телефона
            <input
              required
              type="tel"
              pattern={KYRGYZ_PHONE_PATTERN}
              maxLength={32}
              value={newPhone}
              onChange={(event) =>
                setNewPhone(formatKyrgyzPhoneInput(event.target.value))
              }
              placeholder="+996 700 123 456"
            />
          </label>
          <label>
            Адрес (по желанию)
            <input
              maxLength={500}
              value={newAddress}
              onChange={(event) => setNewAddress(event.target.value)}
            />
          </label>
          <button className="primary" type="submit" disabled={busy || disabled}>
            {busy ? 'Сохраняем…' : 'Создать и выдать приглашение'}
          </button>
        </form>
      )}
      {invitation && (
        <BuyerActivationPanel
          name={invitation.name}
          token={invitation.token}
          expiresAt={invitation.expiresAt}
          onClose={() => setInvitation(null)}
        />
      )}
      <p className="muted">
        Остаток в долг:{' '}
        <strong>
          {debtMinor === null ? 'Проверьте сумму' : formatSom(debtMinor)}
        </strong>
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
