import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { parseSom } from '../api/money';
type Variant = { id: string; name: string; barcode: string };
type Balance = {
  physical: number;
  reserved: number;
  available: number;
  stockValueMinor: number;
};
type Defects = { quantity: number; valueMinor: number };
export default function StockOperationsPage() {
  const { shopId } = useParams(),
    session = useSession();
  const role = session.user?.shops.find((s) => s.id === shopId)?.role;
  const [items, setItems] = useState<Variant[]>([]),
    [variantId, setVariantId] = useState('');
  const [code, setCode] = useState(''),
    [balance, setBalance] = useState<Balance | null>(null),
    [defects, setDefects] = useState<Defects | null>(null);
  const [count, setCount] = useState(''),
    [quantity, setQuantity] = useState(''),
    [unitCost, setUnitCost] = useState('0');
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false);
  // Keep the same key after a network failure; changing the form starts a new operation.
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!shopId || role === 'cashier') return;
    void api<{ items: Variant[] }>(`/shops/${shopId}/variants?pageSize=100`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(errorText(e)));
  }, [shopId, role]);
  useEffect(() => {
    if (!variantId || !shopId) return;
    void Promise.all([
      api<Balance>(`/shops/${shopId}/stock/${variantId}`),
      api<Defects>(`/shops/${shopId}/inventory/defects/${variantId}`),
    ])
      .then(([stock, broken]) => {
        setBalance(stock);
        setDefects(broken);
        setCount(String(stock.physical));
      })
      .catch((e) => setError(errorText(e)));
  }, [shopId, variantId]);
  async function scan(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const found = await api<Variant>(
        `/shops/${shopId}/variants/by-barcode?code=${encodeURIComponent(code.trim())}`,
      );
      setVariantId(found.id);
      setKey(crypto.randomUUID());
      setCode('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function post(kind: 'counts' | 'writeoffs' | 'defects/disposals') {
    if (!variantId || !balance) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const body =
        kind === 'counts'
          ? {
              variantId,
              expectedQuantity: balance.physical,
              countedQuantity: Number(count),
              unitCostMinor: parseSom(unitCost),
              reason,
            }
          : { variantId, quantity: Number(quantity), reason };
      const result = await api<{ id: string }>(
        `/shops/${shopId}/inventory/${kind}`,
        { method: 'POST', key, body },
      );
      setSuccess(`Документ проведён: ${result.id}`);
      setKey(crypto.randomUUID());
      const [stock, broken] = await Promise.all([
        api<Balance>(`/shops/${shopId}/stock/${variantId}`),
        api<Defects>(`/shops/${shopId}/inventory/defects/${variantId}`),
      ]);
      setBalance(stock);
      setDefects(broken);
      setCount(String(stock.physical));
      setReason('');
      setQuantity('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (role === 'cashier' || !role)
    return <p role="alert">Нет доступа к складским операциям.</p>;
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Складской учёт</p>
          <h1>Инвентаризация и списание</h1>
          <p className="muted">
            Пересчёт фактических остатков, списание годного запаса и утилизация
            возвращённого брака
          </p>
        </div>
      </div>
      <section className="panel form-panel" style={{ marginTop: 0 }}>
        <form onSubmit={scan} style={{ marginBottom: '1.25rem' }}>
          <label>
            Сканировать штрихкод
            <input
              value={code}
              placeholder="Введите или отсканируйте штрихкод"
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className="actions">
            <button>Найти</button>
          </div>
        </form>
        <label>
          Товар
          <select
            value={variantId}
            onChange={(e) => {
              setVariantId(e.target.value);
              setKey(crypto.randomUUID());
            }}
          >
            <option value="">Выберите товар</option>
            {items.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.barcode}
              </option>
            ))}
          </select>
        </label>
        {balance && (
          <>
            <div className="notice" style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.25rem' }}>
                В наличии: {balance.physical}; резерв: {balance.reserved};
                доступно: {balance.available}.
              </p>
              <p style={{ margin: 0 }}>
                Возвращённый брак отдельно: {defects?.quantity ?? 0}.
              </p>
            </div>
            <label>
              Фактически посчитано
              <input
                type="number"
                min={0}
                max={1000000000}
                value={count}
                onChange={(e) => {
                  setCount(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <label>
              Стоимость добавленной единицы, сом
              <input
                inputMode="decimal"
                value={unitCost}
                onChange={(e) => {
                  setUnitCost(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <label>
              Количество к списанию или утилизации
              <input
                type="number"
                min={1}
                max={1000000000}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <label>
              Причина
              <input
                maxLength={500}
                value={reason}
                placeholder="Обязательно укажите основание операции"
                onChange={(e) => {
                  setReason(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <div className="actions">
              <button
                className="primary"
                disabled={busy || !reason.trim()}
                onClick={() => void post('counts')}
              >
                Провести пересчёт
              </button>
              <button
                disabled={busy || !reason.trim() || !quantity}
                onClick={() => void post('writeoffs')}
              >
                Списать годный запас
              </button>
              <button
                className="danger"
                disabled={busy || !reason.trim() || !quantity}
                onClick={() => void post('defects/disposals')}
              >
                Утилизировать брак
              </button>
            </div>
          </>
        )}
        {success && (
          <p role="status" className="success" style={{ marginTop: '1rem' }}>
            {success}
          </p>
        )}
        {error && (
          <p role="alert" className="error" style={{ marginTop: '1rem' }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
