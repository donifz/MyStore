import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import { useCurrentShift } from './use-current-shift';

type Customer = {
  id: string;
  name: string;
  phone: string;
  linked?: boolean;
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

export default function CreditDebtsPage() {
  const { shopId = '' } = useParams();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [sales, setSales] = useState<CreditSale[]>([]);
  const [selectedSale, setSelectedSale] = useState('');
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const retry = useRef<{
    saleId: string;
    amountMinor: number;
    method: 'cash' | 'card';
    shiftId: string;
    key: string;
  } | null>(null);
  const shift = useCurrentShift(shopId, String(revision));
  const active =
    shift.current && !('occupied' in shift.current) ? shift.current : null;

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      void api<{ items: Customer[] }>(
        `/shops/${shopId}/customers?q=${encodeURIComponent(search)}&page=1&pageSize=100`,
      )
        .then((data) => {
          if (live) setCustomers(data.items);
        })
        .catch((err) => {
          if (live) setError(errorText(err));
        });
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [shopId, search]);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setSales([]);
      return;
    }
    try {
      const rows = await api<CreditSale[]>(
        `/shops/${shopId}/pos/credit-sales?customerId=${customerId}`,
      );
      setSales(rows);
      setError('');
    } catch (err) {
      setError(errorText(err));
    }
  }, [shopId, customerId]);

  useEffect(() => {
    void refresh();
  }, [refresh, revision]);

  useEffect(() => {
    if (!selectedSale) {
      setRepayments([]);
      return;
    }
    let live = true;
    void api<Repayment[]>(
      `/shops/${shopId}/pos/credit-sales/${selectedSale}/repayments`,
    )
      .then((rows) => {
        if (live) setRepayments(rows);
      })
      .catch((err) => {
        if (live) setError(errorText(err));
      });
    return () => {
      live = false;
    };
  }, [shopId, selectedSale, revision]);

  const selected = sales.find((sale) => sale.saleId === selectedSale);
  const outstanding = sales.reduce((total, sale) => total + sale.debtMinor, 0);

  async function repay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !selected || pending) return;
    let amountMinor: number;
    try {
      amountMinor = parseSom(amount);
    } catch {
      setError('Введите корректную сумму погашения.');
      return;
    }
    if (!amountMinor || amountMinor > selected.debtMinor) {
      setError('Сумма должна быть положительной и не больше остатка долга.');
      return;
    }
    const input = {
      saleId: selected.saleId,
      shiftId: active.id,
      method,
      amountMinor,
    };
    if (
      retry.current &&
      (retry.current.saleId !== input.saleId ||
        retry.current.shiftId !== input.shiftId ||
        retry.current.method !== input.method ||
        retry.current.amountMinor !== input.amountMinor)
    ) {
      setError(
        'После неопределённого результата повторите тот же платёж без изменений или обновите страницу и сверьте историю.',
      );
      return;
    }
    const key = retry.current?.key ?? crypto.randomUUID();
    retry.current = { ...input, key };
    setPending(true);
    setError('');
    setSuccess('');
    try {
      const payment = await api<{ debtMinor: number }>(
        `/shops/${shopId}/pos/credit-sales/${selected.saleId}/repayments`,
        {
          method: 'POST',
          key,
          body: { shiftId: active.id, method, amountMinor },
        },
      );
      retry.current = null;
      setAmount('');
      setSuccess(`Платёж принят. Осталось: ${formatSom(payment.debtMinor)}`);
      setRevision((value) => value + 1);
    } catch (err) {
      setError(errorText(err));
      // Preserve the idempotency key even if the response was lost.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="customer-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MyStore · Касса</p>
          <h1>Погашение долгов</h1>
          <p className="muted">
            Приём платежа без повторного списания товара со склада.
          </p>
        </div>
        <Link to={`/seller/${shopId}/customers`}>Список клиентов</Link>
      </div>
      <section className="panel">
        <label>
          Найти покупателя
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя или +996…"
          />
        </label>
        <label>
          Клиент
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setSelectedSale('');
              retry.current = null;
              setSuccess('');
            }}
          >
            <option value="">Выберите клиента</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} · {customer.phone}
              </option>
            ))}
          </select>
        </label>
        {customerId && (
          <>
            <h2>Общая задолженность: {formatSom(outstanding)}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Продажа</th>
                    <th>К оплате</th>
                    <th>Срок</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.saleId}>
                      <td>
                        {new Date(sale.createdAt).toLocaleDateString('ru-KG')}
                      </td>
                      <td>{formatSom(sale.debtMinor)}</td>
                      <td>{sale.dueOn}</td>
                      <td>
                        <button
                          type="button"
                          disabled={!sale.debtMinor || pending}
                          onClick={() => {
                            setSelectedSale(sale.saleId);
                            retry.current = null;
                            setSuccess('');
                          }}
                        >
                          {sale.debtMinor ? 'Погасить' : 'Погашен'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!sales.length && <p className="muted">Продаж в долг нет.</p>}
          </>
        )}
      </section>
      {selected && (
        <section className="panel">
          <h2>Внести платёж</h2>
          <p>
            Остаток по продаже: <strong>{formatSom(selected.debtMinor)}</strong>
          </p>
          {!active && (
            <p role="alert" className="notice warning">
              Откройте свою кассовую смену для приёма платежа.
            </p>
          )}
          <form onSubmit={(e) => void repay(e)}>
            <label>
              Сумма, сом
              <input
                inputMode="decimal"
                value={amount}
                disabled={pending || !active}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Например, 500"
                required
              />
            </label>
            <label>
              Способ оплаты
              <select
                value={method}
                disabled={pending || !active}
                onChange={(e) => setMethod(e.target.value as 'cash' | 'card')}
              >
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
              </select>
            </label>
            <button
              type="submit"
              className="primary"
              disabled={pending || !active || !selected.debtMinor}
            >
              {pending ? 'Проводим…' : 'Принять погашение'}
            </button>
          </form>
          {success && <p role="status">{success}</p>}
          <h3>История погашений</h3>
          {!repayments.length && <p className="muted">Пока нет платежей.</p>}
          {repayments.map((payment) => (
            <p key={payment.id}>
              {new Date(payment.createdAt).toLocaleString('ru-KG')} ·{' '}
              {formatSom(payment.amountMinor)}
              {' · '}
              {payment.method === 'cash' ? 'Наличные' : 'Карта'}
            </p>
          ))}
        </section>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
