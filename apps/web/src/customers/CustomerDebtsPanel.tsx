import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import { useCurrentShift } from '../pos/use-current-shift';

type Sale = { saleId: string; debtMinor: number; totalMinor: number; paidMinor: number; dueOn: string };
type Payment = { id: string; method: 'cash' | 'card'; amountMinor: number; createdAt: string };

export default function CustomerDebtsPanel({
  shopId, customerId, name,
}: { shopId: string; customerId: string; name: string }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState('');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'card'>('cash');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const key = useRef<string | null>(null);
  const shift = useCurrentShift(shopId, String(revision));

  useEffect(() => {
    let alive = true;
    void api<Sale[]>(`/shops/${shopId}/pos/credit-sales?customerId=${customerId}`)
      .then((rows) => { if (alive) { setSales(rows); setError(''); } })
      .catch((err) => { if (alive) setError(errorText(err)); });
    return () => { alive = false; };
  }, [shopId, customerId, revision]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    void api<Payment[]>(`/shops/${shopId}/pos/credit-sales/${selected}/repayments`)
      .then((rows) => { if (alive) setPayments(rows); })
      .catch((err) => { if (alive) setError(errorText(err)); });
    return () => { alive = false; };
  }, [shopId, selected, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const current = shift.current;
    if (!current || !('id' in current)) {
      setError('Для погашения откройте свою кассовую смену');
      return;
    }
    let amountMinor: number;
    try {
      amountMinor = parseSom(amount);
      if (amountMinor <= 0) throw new Error('invalid amount');
    } catch {
      setError('Введите корректную сумму');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      key.current ??= crypto.randomUUID();
      const response = await api<{ debtMinor: number }>(
        `/shops/${shopId}/pos/credit-sales/${selected}/repayments`,
        { method: 'POST', key: key.current,
          body: { shiftId: current.id, method, amountMinor } },
      );
      key.current = null;
      setAmount('');
      setSuccess('Оплата принята. Осталось: ' + formatSom(response.debtMinor));
      setRevision((n) => n + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Долги: {name}</h2>
      {!sales.length && <p className="muted">Активных долгов нет</p>}
      {sales.map((sale) => (
        <button
          type="button"
          key={sale.saleId}
          aria-pressed={selected === sale.saleId}
          onClick={() => { setSelected(sale.saleId); setPayments([]); setError(''); setSuccess(''); key.current = null; }}
        >
          {formatSom(sale.debtMinor)} · вернуть до {sale.dueOn}
        </button>
      ))}
      {selected && (
        <>
          <h3>Принять погашение</h3>
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Сумма в сомах
              <input required inputMode="decimal" value={amount}
                onChange={(event) => { setAmount(event.target.value); key.current = null; }} />
            </label>
            <label>
              Способ оплаты
              <select value={method} onChange={(event) => {
                setMethod(event.target.value as 'cash' | 'card');
                key.current = null;
              }}>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
              </select>
            </label>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Проводим…' : 'Принять погашение'}
            </button>
          </form>
          <h3>История погашений</h3>
          {payments.map((payment) => (
            <p key={payment.id}>
              {new Date(payment.createdAt).toLocaleDateString('ru-KG')} ·{' '}
              {formatSom(payment.amountMinor)} ·{' '}
              {payment.method === 'cash' ? 'Наличные' : 'Карта'}
            </p>
          ))}
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      {success && <p role="status">{success}</p>}
    </section>
  );
}
