import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, formatDate } from '../api/money';
import { hasShopPermission, type SaleDetail } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import { useDocument } from '../drafts/use-document';
import { useCurrentShift } from './use-current-shift';
type Selection = { quantity: number; condition: 'resellable' | 'defective' };
function ReturnWorkspace({
  shopId,
  userId,
  saleId,
}: {
  shopId: string;
  userId: string;
  saleId: string;
}) {
  const doc = useDocument({ shopId, userId, kind: 'return' }),
    [sale, setSale] = useState<SaleDetail | null>(null),
    [selections, setSelections] = useState<Record<string, Selection>>({}),
    [reason, setReason] = useState(''),
    [refund, setRefund] = useState(true),
    [method, setMethod] = useState<'cash' | 'card'>('cash');
  const pending = doc.draft.submission?.body;
  const sourceSaleId: string = pending?.saleId ?? saleId;
  const shownSelections: Record<string, Selection> = pending
    ? Object.fromEntries(
        pending.lines.map((line: { saleLineId: string } & Selection) => [
          line.saleLineId,
          line,
        ]),
      )
    : selections;
  const shownReason = pending?.reason ?? reason;
  const shownRefund = pending?.refundMoney ?? refund;
  const shownMethod = pending?.method ?? method;
  const shift = useCurrentShift(shopId, doc.success),
    active = shift.current && 'id' in shift.current ? shift.current : null;
  useEffect(() => {
    let alive = true;
    setSale(null);
    api<SaleDetail>(`/shops/${shopId}/pos/sales/${sourceSaleId}`)
      .then((data) => {
        if (alive) {
          setSale(data);
          if (!data.method) setRefund(false);
        }
      })
      .catch((e) => {
        if (alive) doc.setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [shopId, sourceSaleId, doc.success]);
  async function submit() {
    if (doc.draft.submission) {
      await doc.send(`/shops/${shopId}/pos/returns`, doc.draft.submission.body);
      return;
    }
    if (!sale) return;
    const lines = sale.lines
      .filter((l) => selections[l.id]?.quantity > 0)
      .map((l) => ({ saleLineId: l.id, ...selections[l.id] }));
    if (!lines.length || !reason.trim()) {
      doc.setError('Выберите количество и укажите причину возврата.');
      return;
    }
    if (refund && !active) {
      doc.setError('Для выплаты откройте свою смену.');
      return;
    }
    const result = await doc.send(`/shops/${shopId}/pos/returns`, {
      saleId,
      refundMoney: refund,
      reason: reason.trim(),
      ...(refund ? { shiftId: active!.id, method } : {}),
      lines,
    });
    if (result) setSelections({});
  }
  const frozen = doc.busy || doc.blocked || !!doc.draft.submission;
  const total =
    sale?.lines.reduce(
      (n, l) =>
        n +
        BigInt(shownSelections[l.id]?.quantity ?? 0) * BigInt(l.unitPriceMinor),
      0n,
    ) ?? 0n;
  return (
    <>
      <Link className="back-link" to={'/seller/' + shopId + '/sales'}>
        ← Продажи
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Касса магазина</p>
          <h1>Возврат по продаже</h1>
          {sale && (
            <p className="muted">
              {formatDate(sale.createdAt)} · {sale.id}
            </p>
          )}
        </div>
      </div>
      <section className="panel">
        {doc.error && (
          <p className="error" role="alert">
            {doc.error}
          </p>
        )}
        {doc.success && (
          <p className="success" role="status">
            {doc.success}
          </p>
        )}
        {doc.blocked && <button onClick={doc.reload}>Обновить черновик</button>}
        {doc.draft.submission && (
          <p className="notice">
            Неподтверждённый возврат по продаже {sourceSaleId} зафиксирован.
            Показаны исходные данные; повтор отправит их без изменений.
          </p>
        )}
        {sale?.lines.map((l) => (
          <div className="line-card" key={l.id}>
            <div className="line-name">
              <strong>{l.name}</strong>
              <small className="code">
                {l.barcode} · Продано {l.quantity}, возвращено{' '}
                {l.returnedQuantity}
              </small>
              <small>{formatSom(l.unitPriceMinor)}</small>
            </div>
            <label>
              Вернуть {l.name}
              <input
                type="number"
                min={0}
                max={l.quantity - l.returnedQuantity}
                value={shownSelections[l.id]?.quantity ?? 0}
                disabled={frozen}
                onChange={(e) => {
                  const q = Number(e.target.value);
                  if (
                    Number.isInteger(q) &&
                    q >= 0 &&
                    q <= l.quantity - l.returnedQuantity
                  )
                    setSelections((x) => ({
                      ...x,
                      [l.id]: {
                        quantity: q,
                        condition: x[l.id]?.condition ?? 'resellable',
                      },
                    }));
                }}
              />
            </label>
            <label>
              Состояние {l.name}
              <select
                disabled={frozen}
                value={shownSelections[l.id]?.condition ?? 'resellable'}
                onChange={(e) =>
                  setSelections((x) => ({
                    ...x,
                    [l.id]: {
                      quantity: x[l.id]?.quantity ?? 0,
                      condition: e.target.value as Selection['condition'],
                    },
                  }))
                }
              >
                <option value="resellable">Годный товар</option>
                <option value="defective">Брак</option>
              </select>
            </label>
          </div>
        ))}
        <div className="form-panel">
          <label>
            Причина возврата
            <textarea
              value={shownReason}
              maxLength={500}
              disabled={frozen}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {sale?.method ? (
            <label className="checkbox checkbox-label">
              <input
                type="checkbox"
                checked={shownRefund}
                disabled={frozen}
                onChange={(e) => setRefund(e.target.checked)}
              />
              Вернуть деньги покупателю
            </label>
          ) : (
            <p className="notice">
              У этой продажи нет записи оплаты. Доступен только товарный
              возврат.
            </p>
          )}
          {shownRefund && sale?.method && (
            <label>
              Способ возврата денег
              <select
                value={shownMethod}
                disabled={frozen}
                onChange={(e) => setMethod(e.target.value as 'cash' | 'card')}
              >
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
              </select>
            </label>
          )}
          <p className="total">
            {total <= BigInt(Number.MAX_SAFE_INTEGER)
              ? formatSom(Number(total))
              : 'Сумма превышена'}
          </p>
          <p className="muted">
            Годный товар вернётся в доступный остаток. Брак будет учтён
            отдельно. Выплату сотрудник выполняет самостоятельно.
          </p>
          <button
            className="primary"
            disabled={doc.busy || doc.blocked || !doc.online || !sale}
            onClick={() => void submit()}
          >
            {doc.draft.submission
              ? 'Повторить исходный запрос'
              : 'Провести возврат'}
          </button>
        </div>
      </section>
    </>
  );
}
export default function ReturnPage() {
  const { shopId, saleId } = useParams(),
    s = useSession();
  if (
    !hasShopPermission(
      s.user?.shops.find((x) => x.id === shopId),
      'return',
    )
  )
    return (
      <p role="alert">
        Нет разрешения на возвраты. Обратитесь к владельцу магазина.
      </p>
    );
  return (
    <ReturnWorkspace
      key={shopId + s.user!.userId + saleId}
      shopId={shopId!}
      userId={s.user!.userId}
      saleId={saleId!}
    />
  );
}
