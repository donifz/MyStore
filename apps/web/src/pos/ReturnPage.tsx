import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, formatDate } from '../api/money';
import { hasShopPermission, type SaleDetail } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import { normalizeIntegerInput } from '../components/numeric-input';
import { useDocument } from '../drafts/use-document';
import { useCurrentShift } from './use-current-shift';

type Selection = { quantity: number; condition: 'resellable' | 'defective' };

const RETURN_REASON_PRESETS = [
  'Не подошёл товар',
  'Брак / повреждение',
  'Ошибка кассира',
];

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
    [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({}),
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

  function updateQuantity(lineId: string, maxQty: number, nextQty: number) {
    const clamped = Math.max(0, Math.min(maxQty, Math.trunc(nextQty)));
    setSelections((x) => ({
      ...x,
      [lineId]: {
        quantity: clamped,
        condition: x[lineId]?.condition ?? 'resellable',
      },
    }));
    setQtyDrafts((d) => ({ ...d, [lineId]: String(clamped) }));
  }

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
    if (result) {
      setSelections({});
      setQtyDrafts({});
    }
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
            <p className="muted" title={sale.id}>
              {formatDate(sale.createdAt)} · Чек #
              {sale.id.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>
      </div>
      <section className="panel return-panel">
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

        <div className="return-lines-list">
          {sale?.lines.map((l) => {
            const maxQty = Math.max(0, l.quantity - l.returnedQuantity);
            const currentQty = shownSelections[l.id]?.quantity ?? 0;
            const inputValue =
              !pending && qtyDrafts[l.id] !== undefined
                ? qtyDrafts[l.id]
                : String(currentQty);
            const lineSubtotal = BigInt(currentQty) * BigInt(l.unitPriceMinor);

            return (
              <div className="line-card return-line-card" key={l.id}>
                <div className="return-line-card__head">
                  <div className="line-name">
                    <strong>{l.name}</strong>
                    <div className="return-line-card__meta">
                      <small className="code">{l.barcode}</small>
                      <small className="muted">
                        Продано {l.quantity}, возвращено {l.returnedQuantity}
                      </small>
                    </div>
                  </div>
                  <div className="return-line-card__price">
                    <strong>{formatSom(l.unitPriceMinor)}</strong>
                    <small className="muted">за шт.</small>
                  </div>
                </div>

                <div className="return-line-card__controls">
                  <div className="return-qty-block">
                    <label htmlFor={`return-qty-${l.id}`}>
                      Вернуть {l.name}
                    </label>
                    <div className="return-qty-row">
                      <div className="pos-stepper return-stepper">
                        <button
                          type="button"
                          aria-label={`Уменьшить возврат ${l.name}`}
                          disabled={frozen || currentQty <= 0}
                          onClick={() =>
                            updateQuantity(l.id, maxQty, currentQty - 1)
                          }
                        >
                          −
                        </button>
                        <input
                          id={`return-qty-${l.id}`}
                          type="number"
                          min={0}
                          max={maxQty}
                          value={inputValue}
                          disabled={frozen || maxQty === 0}
                          onChange={(e) => {
                            const cleaned = normalizeIntegerInput(
                              e.target.value,
                            );
                            if (e.target.value !== cleaned) {
                              e.currentTarget.value = cleaned;
                            }
                            if (cleaned === '') {
                              setQtyDrafts((d) => ({ ...d, [l.id]: '' }));
                              setSelections((x) => ({
                                ...x,
                                [l.id]: {
                                  quantity: 0,
                                  condition: x[l.id]?.condition ?? 'resellable',
                                },
                              }));
                              return;
                            }
                            const q = Number(cleaned);
                            if (Number.isInteger(q) && q >= 0 && q <= maxQty) {
                              setQtyDrafts((d) => ({ ...d, [l.id]: cleaned }));
                              setSelections((x) => ({
                                ...x,
                                [l.id]: {
                                  quantity: q,
                                  condition: x[l.id]?.condition ?? 'resellable',
                                },
                              }));
                            }
                          }}
                          onBlur={() => {
                            if (qtyDrafts[l.id] === '') {
                              setQtyDrafts((d) => ({
                                ...d,
                                [l.id]: String(currentQty),
                              }));
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Увеличить возврат ${l.name}`}
                          disabled={frozen || currentQty >= maxQty}
                          onClick={() =>
                            updateQuantity(l.id, maxQty, currentQty + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                      {maxQty > 0 && (
                        <button
                          type="button"
                          className="secondary return-all-btn"
                          disabled={frozen || currentQty === maxQty}
                          onClick={() => updateQuantity(l.id, maxQty, maxQty)}
                        >
                          Всё ({maxQty})
                        </button>
                      )}
                    </div>
                  </div>

                  <label className="return-condition-field">
                    Состояние {l.name}
                    <select
                      disabled={frozen || maxQty === 0}
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

                {currentQty > 0 && (
                  <div className="return-line-card__subtotal">
                    <span className="admin-kit-status green">
                      К возврату: {formatSom(Number(lineSubtotal))}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="form-panel return-form-panel">
          <div className="return-reason-block">
            <label htmlFor="return-reason-input">Причина возврата</label>
            <div className="return-reason-chips">
              {RETURN_REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`return-reason-chip${shownReason === preset ? ' is-active' : ''}`}
                  disabled={frozen}
                  onClick={() => setReason(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              id="return-reason-input"
              value={shownReason}
              maxLength={500}
              disabled={frozen}
              placeholder="Укажите причину возврата товара..."
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {sale?.method ? (
            <div className="return-refund-card">
              <label className="checkbox checkbox-label return-refund-toggle">
                <input
                  type="checkbox"
                  checked={shownRefund}
                  disabled={frozen}
                  onChange={(e) => setRefund(e.target.checked)}
                />
                <span>Вернуть деньги покупателю</span>
              </label>
              {shownRefund && (
                <label className="return-refund-method">
                  Способ возврата денег
                  <select
                    value={shownMethod}
                    disabled={frozen}
                    onChange={(e) =>
                      setMethod(e.target.value as 'cash' | 'card')
                    }
                  >
                    <option value="cash">Наличные</option>
                    <option value="card">Карта</option>
                  </select>
                </label>
              )}
            </div>
          ) : (
            <p className="notice">
              У этой продажи нет записи оплаты. Доступен только товарный
              возврат.
            </p>
          )}

          <div className="return-summary-box">
            <div className="return-summary-box__row">
              <span className="muted">Итого к возврату</span>
              <p className="total">
                {total <= BigInt(Number.MAX_SAFE_INTEGER)
                  ? formatSom(Number(total))
                  : 'Сумма превышена'}
              </p>
            </div>
            <p className="muted return-summary-box__hint">
              Годный товар вернётся в доступный остаток. Брак будет учтён
              отдельно. Выплату сотрудник выполняет самостоятельно.
            </p>
            <button
              type="button"
              className="primary return-submit-btn"
              disabled={doc.busy || doc.blocked || !doc.online || !sale}
              onClick={() => void submit()}
            >
              {doc.draft.submission
                ? 'Повторить исходный запрос'
                : 'Провести возврат'}
            </button>
          </div>
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
