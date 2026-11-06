import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
import { formatSom } from '../api/money';

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

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api<{ items: Customer[] }>(
        `/shops/${shopId}/customers?page=1&pageSize=100&q=${encodeURIComponent(q)}`,
      ).then((page) => {
        if (active) {
          setCustomers(page.items.filter((c) => c.linked && c.creditApproved));
          setError('');
        }
      }).catch((e) => {
        if (active) setError(errorText(e));
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [shopId, enabled, q]);

  if (!enabled) return null;

  return (
    <div className="pos-credit-fields">
      <p className="muted">
        Клиент должен привязать кабинет, а владелец — разрешить кредит и установить лимит.
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
              {customer.name} · {customer.phone} · лимит {formatSom(Number(customer.creditLimitMinor))}
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
      <p className="muted">
        Остаток в долг: <strong>{debtMinor === null ? 'Проверьте сумму' : formatSom(debtMinor)}</strong>
      </p>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}
