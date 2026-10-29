import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { parseSom, formatSom, formatDate } from '../api/money';
import { api, errorText } from '../api/client';
import { useDocument } from '../drafts/use-document';
import { useCurrentShift } from './use-current-shift';
import { CashTransaction, Shift } from '../api/types';
function ShiftWorkspace({
  shopId,
  userId,
}: {
  shopId: string;
  userId: string;
}) {
  const opening = useDocument({ shopId, userId, kind: 'shift-open' }),
    closing = useDocument({ shopId, userId, kind: 'shift-close' }),
    [openingCash, setOpeningCash] = useState('0'),
    [actual, setActual] = useState(''),
    [comment, setComment] = useState(''),
    [lastClosed, setLastClosed] = useState<Shift | null>(null),
    [shiftTrigger, setShiftTrigger] = useState(0),
    [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [cashModal, setCashModal] = useState<'in' | 'out' | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashReason, setCashReason] = useState('');
  const [cashBusy, setCashBusy] = useState(false);
  const [cashError, setCashError] = useState('');

  const s = useCurrentShift(
    shopId,
    `${opening.success}:${closing.success}:${shiftTrigger}`,
    useSession().user?.shops.find((x) => x.id === shopId)?.role === 'owner',
  );
  const shift = s.current && 'id' in s.current ? s.current : null;

  const loadTransactions = useCallback(
    async (sId: string) => {
      setLoadingTx(true);
      try {
        const list = await api<CashTransaction[]>(
          `/shops/${shopId}/pos/shifts/${sId}/transactions`,
        );
        setTransactions(list);
      } catch {
        // ignore
      } finally {
        setLoadingTx(false);
      }
    },
    [shopId],
  );

  useEffect(() => {
    if (shift?.id) {
      void loadTransactions(shift.id);
    } else {
      setTransactions([]);
    }
  }, [shift?.id, loadTransactions]);

  async function handleCashOperation(type: 'in' | 'out') {
    if (!shift) return;
    setCashError('');
    let minor: number;
    try {
      minor = parseSom(cashAmount);
      if (minor <= 0) {
        setCashError('Сумма должна быть больше нуля.');
        return;
      }
    } catch (e: any) {
      setCashError(e.message || 'Неверная сумма');
      return;
    }
    if (!cashReason.trim()) {
      setCashError('Укажите причину операции.');
      return;
    }
    setCashBusy(true);
    try {
      const endpoint = `/shops/${shopId}/pos/shifts/${shift.id}/cash-${type}`;
      await api(endpoint, {
        method: 'POST',
        key: crypto.randomUUID(),
        body: {
          amountMinor: minor,
          reason: cashReason.trim(),
        },
      });
      setCashModal(null);
      setCashAmount('');
      setCashReason('');
      setShiftTrigger((n) => n + 1);
      await loadTransactions(shift.id);
    } catch (e) {
      setCashError(errorText(e));
    } finally {
      setCashBusy(false);
    }
  }

  async function open() {
    try {
      await opening.send(
        `/shops/${shopId}/pos/shifts`,
        opening.draft.submission?.body ?? {
          openingCashMinor: parseSom(openingCash),
        },
      );
    } catch (e) {
      opening.setError(errorText(e));
    }
  }
  async function submitClose() {
    try {
      if (!shift && !closing.draft.submission) return;
      const body = closing.draft.submission?.body ?? {
        actualCashMinor: parseSom(actual),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      };
      const result = await closing.send(
        closing.draft.submission?.path ??
          `/shops/${shopId}/pos/shifts/${shift!.id}/close`,
        body,
      );
      if (result) setLastClosed(result as Shift);
    } catch (e) {
      closing.setError(errorText(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Контроль кассы</p>
          <h1>Смена</h1>
        </div>
        <Link className="button" to={'/seller/' + shopId + '/pos'}>
          Перейти к кассе
        </Link>
      </div>
      {s.error && (
        <p role="alert" className="error">
          {s.error}
        </p>
      )}
      {s.loading && <p>Загрузка…</p>}
      {s.current && 'occupied' in s.current && (
        <p className="notice">Касса занята другим сотрудником.</p>
      )}
      {opening.draft.submission && (
        <section className="panel form-panel">
          <h2>Подтвердить исходное открытие</h2>
          <p>
            Начальные наличные:{' '}
            {formatSom(opening.draft.submission.body.openingCashMinor)}
          </p>
          <button
            className="primary"
            disabled={opening.busy || opening.blocked || !opening.online}
            onClick={() => void open()}
          >
            Повторить открытие
          </button>
        </section>
      )}
      {closing.draft.submission && !shift && (
        <button
          className="primary"
          disabled={
            closing.busy ||
            closing.blocked ||
            !closing.online ||
            !!opening.draft.submission
          }
          onClick={() => void submitClose()}
        >
          Повторить закрытие
        </button>
      )}
      {lastClosed && (
        <section className="panel">
          <h2>Смена закрыта</h2>
          <p>Расхождение: {formatSom(lastClosed.discrepancyMinor ?? 0)}</p>
          <p>
            Фактические наличные: {formatSom(lastClosed.actualCashMinor ?? 0)}
          </p>
        </section>
      )}
      {shift ? (
        <>
          <section className="panel">
            <h2>Смена открыта</h2>
            <p className="muted">С {formatDate(shift.openedAt)}</p>
            <div className="stats">
              <div className="panel">
                Ожидаемые наличные
                <strong>{formatSom(shift.expectedCashMinor)}</strong>
              </div>
              <div className="panel">
                Внесено наличных
                <strong>{formatSom(shift.cashInMinor ?? 0)}</strong>
              </div>
              <div className="panel">
                Изъято наличных
                <strong>{formatSom(shift.cashOutMinor ?? 0)}</strong>
              </div>
              <div className="panel">
                Продажи наличными
                <strong>{formatSom(shift.salesCashMinor)}</strong>
              </div>
              <div className="panel">
                Продажи картой
                <strong>{formatSom(shift.salesCardMinor)}</strong>
              </div>
              <div className="panel">
                Возвраты наличными
                <strong>{formatSom(shift.refundsCashMinor)}</strong>
              </div>
              <div className="panel">
                Возвраты картой
                <strong>{formatSom(shift.refundsCardMinor)}</strong>
              </div>
            </div>

            <div className="actions" style={{ margin: '1.25rem 0' }}>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setCashModal('in');
                  setCashError('');
                  setCashAmount('');
                  setCashReason('');
                }}
              >
                + Внесение наличных
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setCashModal('out');
                  setCashError('');
                  setCashAmount('');
                  setCashReason('');
                }}
              >
                − Изъятие наличных
              </button>
            </div>

            {cashModal && (
              <section
                className="panel form-panel"
                style={{
                  marginBottom: '1.5rem',
                  border: '1px solid var(--color-border, #ddd)',
                  borderRadius: '8px',
                  padding: '1rem',
                }}
              >
                <h3>
                  {cashModal === 'in'
                    ? 'Внесение наличных'
                    : 'Изъятие наличных'}
                </h3>
                {cashError && (
                  <p role="alert" className="error">
                    {cashError}
                  </p>
                )}
                <label>
                  Сумма, сом
                  <input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    disabled={cashBusy}
                    autoFocus
                  />
                </label>
                <label>
                  Причина операции
                  <input
                    type="text"
                    maxLength={255}
                    placeholder={
                      cashModal === 'in'
                        ? 'Например: Разменный фонд, довнесение'
                        : 'Например: Инкассация, хоз. расходы'
                    }
                    value={cashReason}
                    onChange={(e) => setCashReason(e.target.value)}
                    disabled={cashBusy}
                  />
                </label>
                <div className="actions" style={{ marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="primary"
                    disabled={cashBusy}
                    onClick={() => void handleCashOperation(cashModal)}
                  >
                    {cashBusy ? 'Проведение…' : 'Подтвердить'}
                  </button>
                  <button
                    type="button"
                    disabled={cashBusy}
                    onClick={() => setCashModal(null)}
                  >
                    Отмена
                  </button>
                </div>
              </section>
            )}

            <div className="form-panel">
              <h3>Закрытие смены</h3>
              <label>
                Фактические наличные, сом
                <input
                  inputMode="decimal"
                  value={
                    closing.draft.submission
                      ? (
                          closing.draft.submission.body.actualCashMinor / 100
                        ).toFixed(2)
                      : actual
                  }
                  onChange={(e) => setActual(e.target.value)}
                  disabled={!!closing.draft.submission}
                />
              </label>
              <label>
                Комментарий к закрытию
                <textarea
                  maxLength={500}
                  value={closing.draft.submission?.body.comment ?? comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={!!closing.draft.submission}
                />
              </label>
              <p className="muted">
                При расхождении укажите причину. Проведённые документы остаются
                в истории.
              </p>
              <button
                className="primary"
                disabled={
                  closing.busy ||
                  closing.blocked ||
                  !closing.online ||
                  !!opening.draft.submission
                }
                onClick={() => void submitClose()}
              >
                {closing.draft.submission
                  ? 'Повторить закрытие'
                  : 'Закрыть смену'}
              </button>
            </div>

            <section style={{ marginTop: '2rem' }}>
              <h3>Движения наличных за смену</h3>
              {loadingTx && <p className="muted">Загрузка операций…</p>}
              {!loadingTx && !transactions.length && (
                <p className="empty-state">
                  Внесений и изъятий за смену пока не было.
                </p>
              )}
              {transactions.length > 0 && (
                <div className="table-wrap" style={{ marginTop: '0.5rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Время</th>
                        <th>Тип</th>
                        <th>Сумма</th>
                        <th>Причина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{formatDate(tx.createdAt)}</td>
                          <td>
                            <span
                              style={{
                                color: tx.type === 'in' ? '#007659' : '#b3261e',
                                fontWeight: 'bold',
                              }}
                            >
                              {tx.type === 'in' ? '+ Внесение' : '− Изъятие'}
                            </span>
                          </td>
                          <td>
                            <strong>{formatSom(tx.amountMinor)}</strong>
                          </td>
                          <td>{tx.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        </>
      ) : (
        !s.current &&
        !s.loading &&
        !opening.draft.submission &&
        !closing.draft.submission && (
          <section className="panel form-panel">
            <h2>Открыть смену</h2>
            <label>
              Начальные наличные, сом
              <input
                inputMode="decimal"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                disabled={!!opening.draft.submission}
              />
            </label>
            <button
              className="primary"
              disabled={opening.busy || opening.blocked || !opening.online}
              onClick={() => void open()}
            >
              {opening.draft.submission
                ? 'Повторить открытие'
                : 'Открыть смену'}
            </button>
          </section>
        )
      )}
      {[opening, closing].map((doc, i) => (
        <div key={i}>
          {doc.error && (
            <p role="alert" className="error">
              {doc.error}
            </p>
          )}
          {doc.blocked && (
            <button onClick={doc.reload}>Обновить черновик</button>
          )}
          {doc.draft.submission && (
            <p className="notice">
              Результат неизвестен. Повтор использует прежние данные.
            </p>
          )}
        </div>
      ))}
    </>
  );
}
export default function ShiftPage() {
  const { shopId } = useParams(),
    s = useSession();
  return (
    <ShiftWorkspace
      key={shopId + s.user!.userId}
      shopId={shopId!}
      userId={s.user!.userId}
    />
  );
}
