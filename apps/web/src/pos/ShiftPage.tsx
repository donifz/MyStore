import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { parseSom, formatSom, formatDate } from '../api/money';
import { api, errorText } from '../api/client';
import { useDocument } from '../drafts/use-document';
import { useCurrentShift } from './use-current-shift';
import { CashTransaction, Shift } from '../api/types';
import TelegramOwnerSettings from '../operations/TelegramOwnerSettings';

type DetailedExpense = {
  reason: string;
  amount: string;
};

const DEFAULT_TEMPLATES = ['Обед', 'Упаковка / пакеты', 'Доставка'];

function getStoredTemplates(shopId: string): string[] {
  try {
    const raw = localStorage.getItem(`mystore:expense-templates:${shopId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_TEMPLATES;
}

function storeTemplates(shopId: string, reasons: string[]) {
  try {
    const unique = Array.from(
      new Set(reasons.map((r) => r.trim()).filter((r) => r.length > 0)),
    );
    if (unique.length > 0) {
      localStorage.setItem(
        `mystore:expense-templates:${shopId}`,
        JSON.stringify(unique),
      );
    }
  } catch {}
}

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
    [latestShift, setLatestShift] = useState<Shift | null>(null),
    [shiftTrigger, setShiftTrigger] = useState(0),
    [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [cashModal, setCashModal] = useState<'in' | 'out' | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashReason, setCashReason] = useState('');
  const [cashBusy, setCashBusy] = useState(false);
  const [cashError, setCashError] = useState('');

  // Detailed expenses for closing
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseItems, setExpenseItems] = useState<DetailedExpense[]>(() => {
    return getStoredTemplates(shopId).map((reason) => ({
      reason,
      amount: '',
    }));
  });

  const isOwner =
    useSession().user?.shops.find((x) => x.id === shopId)?.role === 'owner';
  const s = useCurrentShift(
    shopId,
    `${opening.success}:${closing.success}:${shiftTrigger}`,
    isOwner,
  );
  const shift = s.current && 'id' in s.current ? s.current : null;

  // Load latest shift (to display when current shift is closed)
  useEffect(() => {
    let active = true;
    api<Shift | null>(`/shops/${shopId}/pos/shifts/latest`)
      .then((res) => {
        if (!active) return;
        setLatestShift(res);
        if (
          res &&
          res.actualCashMinor !== null &&
          (openingCash === '0' || !openingCash)
        ) {
          setOpeningCash((res.actualCashMinor / 100).toFixed(0));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId, shiftTrigger, opening.success, closing.success]);

  const loadTransactions = useCallback(
    async (sId: string) => {
      setLoadingTx(true);
      try {
        const list = await api<CashTransaction[]>(
          `/shops/${shopId}/pos/shifts/${sId}/transactions`,
        );
        setTransactions(list);
      } catch {
        // quiet
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
      const validExpenses = expenseItems
        .filter((it) => it.reason.trim() && it.amount.trim())
        .map((it) => ({
          reason: it.reason.trim(),
          amountMinor: parseSom(it.amount),
        }))
        .filter((it) => it.amountMinor > 0);

      const body = closing.draft.submission?.body ?? {
        actualCashMinor: parseSom(actual),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        ...(validExpenses.length > 0 ? { expenses: validExpenses } : {}),
      };
      const result = await closing.send(
        closing.draft.submission?.path ??
          `/shops/${shopId}/pos/shifts/${shift!.id}/close`,
        body,
      );
      if (result) {
        setLastClosed(result as Shift);
        if (validExpenses.length > 0) {
          storeTemplates(
            shopId,
            validExpenses.map((e) => e.reason),
          );
        }
      }
    } catch (e) {
      closing.setError(errorText(e));
    }
  }

  // Active shift metrics calculation
  const activeMetrics = useMemo(() => {
    if (!shift) return null;
    const salesCash = shift.salesCashMinor || 0;
    const salesCard = shift.salesCardMinor || 0;
    const repCash = shift.repaymentsCashMinor || 0;
    const repCard = shift.repaymentsCardMinor || 0;
    const refCash = shift.refundsCashMinor || 0;
    const refCard = shift.refundsCardMinor || 0;

    const cashRevenue = salesCash + repCash - refCash;
    const cardRevenue = salesCard + repCard - refCard;
    const totalRevenue = cashRevenue + cardRevenue;

    const repaymentsTotal = repCash + repCard;
    const refundsTotal = refCash + refCard;

    return {
      totalRevenue,
      cashRevenue,
      cardRevenue,
      repaymentsTotal,
      refundsTotal,
    };
  }, [shift]);

  // Live discrepancy while typing actual cash
  const liveDiscrepancy = useMemo(() => {
    if (!shift || !actual.trim()) return null;
    try {
      const parsed = parseSom(actual);
      return parsed - shift.expectedCashMinor;
    } catch {
      return null;
    }
  }, [shift, actual]);

  // Total detailed expenses sum
  const totalDetailedExpensesMinor = useMemo(() => {
    return expenseItems.reduce((acc, it) => {
      if (!it.reason.trim() || !it.amount.trim()) return acc;
      try {
        const val = parseSom(it.amount);
        return acc + (val > 0 ? val : 0);
      } catch {
        return acc;
      }
    }, 0);
  }, [expenseItems]);

  const activeExpenseCount = useMemo(() => {
    return expenseItems.filter((it) => it.reason.trim() && it.amount.trim())
      .length;
  }, [expenseItems]);

  // Closed shift view data
  const closedShift =
    lastClosed || (latestShift?.status === 'closed' ? latestShift : null);

  const closedRevenue = useMemo(() => {
    if (!closedShift) return 0;
    const sales =
      (closedShift.salesCashMinor || 0) + (closedShift.salesCardMinor || 0);
    const rep =
      (closedShift.repaymentsCashMinor || 0) +
      (closedShift.repaymentsCardMinor || 0);
    const ref =
      (closedShift.refundsCashMinor || 0) + (closedShift.refundsCardMinor || 0);
    return Math.max(0, sales + rep - ref);
  }, [closedShift]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Контроль кассы</p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <h1 style={{ margin: 0 }}>Смена</h1>
            {!shift && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Смена закрыта
              </span>
            )}
          </div>
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
      {s.loading && <p>Загрузка данных смены…</p>}
      {s.current && 'occupied' in s.current && (
        <p className="notice">
          Касса занята другим сотрудником. Дождитесь закрытия его смены.
        </p>
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
        /* ================= OPEN SHIFT VIEW ================= */
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
          <section
            className="panel"
            style={{
              padding: '0.875rem 1.25rem',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block',
                }}
              />
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Смена открыта</h2>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
              С {formatDate(shift.openedAt)}
            </p>
          </section>

          {/* Key KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Card 1: Revenue */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Выручка за смену
                </span>
                <span style={{ fontSize: '1.25rem' }}>💰</span>
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.1,
                  marginBottom: '10px',
                }}
              >
                {formatSom(activeMetrics?.totalRevenue ?? 0)}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '0.825rem',
                }}
              >
                <span
                  style={{
                    background: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}
                >
                  💵 Наличные: {formatSom(activeMetrics?.cashRevenue ?? 0)}
                </span>
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 600,
                  }}
                >
                  💳 Карта: {formatSom(activeMetrics?.cardRevenue ?? 0)}
                </span>
              </div>
            </div>

            {/* Card 2: Cash in Register */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  В кассе (наличные)
                </span>
                <span style={{ fontSize: '1.25rem' }}>💵</span>
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#065f46',
                  lineHeight: 1.1,
                  marginBottom: '10px',
                }}
              >
                {formatSom(shift.expectedCashMinor)}
              </div>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#64748b',
                  lineHeight: 1.4,
                }}
              >
                Начало: {formatSom(shift.openingCashMinor)}
                {(shift.cashInMinor ?? 0) > 0 &&
                  ` • Внесено: +${formatSom(shift.cashInMinor ?? 0)}`}
                {(shift.cashOutMinor ?? 0) > 0 &&
                  ` • Изъято: −${formatSom(shift.cashOutMinor ?? 0)}`}
              </div>
            </div>
          </div>

          {/* Secondary KPIs (if repayments or refunds happened) */}
          {((activeMetrics?.repaymentsTotal ?? 0) > 0 ||
            (activeMetrics?.refundsTotal ?? 0) > 0) && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: '10px',
                fontSize: '0.85rem',
                color: '#475569',
              }}
            >
              {(activeMetrics?.repaymentsTotal ?? 0) > 0 && (
                <span>
                  🤝 Погашение долгов:{' '}
                  <strong>
                    {formatSom(activeMetrics?.repaymentsTotal ?? 0)}
                  </strong>
                </span>
              )}
              {(activeMetrics?.refundsTotal ?? 0) > 0 && (
                <span>
                  ↩️ Возвраты:{' '}
                  <strong>{formatSom(activeMetrics?.refundsTotal ?? 0)}</strong>
                </span>
              )}
            </div>
          )}

          {/* Fast Cash Drawer Actions */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              marginTop: '4px',
            }}
          >
            <button
              type="button"
              className="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f0fdf4',
                borderColor: '#86efac',
                color: '#166534',
                fontWeight: 600,
              }}
              onClick={() => {
                setCashModal('in');
                setCashError('');
                setCashAmount('');
                setCashReason('');
              }}
            >
              <span>+</span> Внесение наличных
            </button>
            <button
              type="button"
              className="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fef2f2',
                borderColor: '#fca5a5',
                color: '#991b1b',
                fontWeight: 600,
              }}
              onClick={() => {
                setCashModal('out');
                setCashError('');
                setCashAmount('');
                setCashReason('');
              }}
            >
              <span>−</span> Изъятие / Расход
            </button>
          </div>

          {/* Inline Cash Operation Form Modal */}
          {cashModal && (
            <section
              className="panel form-panel"
              style={{
                border: '2px solid #94c9bc',
                borderRadius: '12px',
                background: '#ffffff',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {cashModal === 'in'
                  ? '➕ Внесение наличных в кассу'
                  : '➖ Изъятие наличных из кассы'}
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
                  {cashBusy ? 'Проведение…' : 'Подтвердить операцию'}
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

          {/* Shift Closing Section */}
          <div
            className="panel form-panel"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '14px',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  Закрытие смены
                </h3>
                <p
                  className="muted"
                  style={{ margin: '4px 0 0', fontSize: '0.85rem' }}
                >
                  Пересчитайте наличные в ящике перед закрытием.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '6px',
              }}
            >
              <label
                htmlFor="actual-cash-input"
                style={{ margin: 0, fontWeight: 600 }}
              >
                Фактические наличные, сом
              </label>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007659',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
                onClick={() =>
                  setActual((shift.expectedCashMinor / 100).toFixed(2))
                }
              >
                ⚡ Совпадает ({formatSom(shift.expectedCashMinor)})
              </button>
            </div>
            <input
              id="actual-cash-input"
              inputMode="decimal"
              placeholder={(shift.expectedCashMinor / 100).toFixed(2)}
              value={
                closing.draft.submission
                  ? (
                      closing.draft.submission.body.actualCashMinor / 100
                    ).toFixed(2)
                  : actual
              }
              onChange={(e) => setActual(e.target.value)}
              disabled={!!closing.draft.submission}
              style={{ marginBottom: '14px' }}
            />

            {/* Live Discrepancy Helper */}
            {liveDiscrepancy !== null && (
              <div
                style={{
                  marginTop: '-10px',
                  marginBottom: '14px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background:
                    liveDiscrepancy === 0
                      ? '#f0fdf4'
                      : liveDiscrepancy > 0
                        ? '#eff6ff'
                        : '#fef2f2',
                  color:
                    liveDiscrepancy === 0
                      ? '#166534'
                      : liveDiscrepancy > 0
                        ? '#1e40af'
                        : '#991b1b',
                  border: `1px solid ${
                    liveDiscrepancy === 0
                      ? '#bbf7d0'
                      : liveDiscrepancy > 0
                        ? '#bfdbfe'
                        : '#fecaca'
                  }`,
                }}
              >
                {liveDiscrepancy === 0
                  ? '✅ Наличные сходятся (расхождений нет)'
                  : liveDiscrepancy > 0
                    ? `ℹ️ Излишек в кассе: +${formatSom(liveDiscrepancy)}`
                    : `⚠️ Недостача в кассе: ${formatSom(liveDiscrepancy)}`}
              </div>
            )}

            {/* Detailed Expenses Button and Modal */}
            <div style={{ marginBottom: '14px' }}>
              <button
                type="button"
                className="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.875rem',
                  background:
                    totalDetailedExpensesMinor > 0 ? '#f0fdf4' : '#f8fafc',
                  borderColor:
                    totalDetailedExpensesMinor > 0 ? '#86efac' : '#cbd5e1',
                  color: totalDetailedExpensesMinor > 0 ? '#166534' : 'inherit',
                  fontWeight: totalDetailedExpensesMinor > 0 ? 600 : 500,
                }}
                onClick={() => setExpenseModalOpen(true)}
              >
                <span>🧾</span>
                <span>Детальный расход кассы</span>
                {totalDetailedExpensesMinor > 0 && (
                  <span
                    style={{
                      background: '#166534',
                      color: '#fff',
                      fontSize: '0.75rem',
                      padding: '2px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {formatSom(totalDetailedExpensesMinor)} (
                    {activeExpenseCount})
                  </span>
                )}
              </button>
            </div>

            {/* Detailed Expenses Modal */}
            {expenseModalOpen && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  zIndex: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                }}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    width: 'min(100%, 480px)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem',
                    }}
                  >
                    <h3 style={{ margin: 0 }}>🧾 Расходы кассы за смену</h3>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onClick={() => setExpenseModalOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                  <p
                    className="muted"
                    style={{ fontSize: '0.85rem', marginTop: 0 }}
                  >
                    Укажите расходы (обед, доставка, хознужды). Статьи
                    запоминаются для следующих смен.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginBottom: '1rem',
                    }}
                  >
                    {expenseItems.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 100px 36px',
                          gap: '6px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Статья расхода"
                          value={item.reason}
                          onChange={(e) => {
                            const next = [...expenseItems];
                            next[idx].reason = e.target.value;
                            setExpenseItems(next);
                          }}
                        />
                        <input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e) => {
                            const next = [...expenseItems];
                            next[idx].amount = e.target.value;
                            setExpenseItems(next);
                          }}
                        />
                        <button
                          type="button"
                          style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            borderRadius: '6px',
                            height: '38px',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setExpenseItems(
                              expenseItems.filter((_, i) => i !== idx),
                            );
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        background: '#f1f5f9',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        setExpenseItems([
                          ...expenseItems,
                          { reason: '', amount: '' },
                        ])
                      }
                    >
                      + Добавить строку
                    </button>
                    <strong>
                      Всего: {formatSom(totalDetailedExpensesMinor)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="primary"
                    style={{ width: '100%' }}
                    onClick={() => {
                      setExpenseModalOpen(false);
                      storeTemplates(
                        shopId,
                        expenseItems
                          .map((e) => e.reason)
                          .filter((r) => r.trim().length > 0),
                      );
                    }}
                  >
                    Готово
                  </button>
                </div>
              </div>
            )}

            <label>
              Комментарий к закрытию
              <textarea
                maxLength={500}
                placeholder="Укажите причину расхождения или примечание"
                value={closing.draft.submission?.body.comment ?? comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={!!closing.draft.submission}
                rows={2}
              />
            </label>

            <button
              className="primary"
              style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
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

          {/* Cash Transactions Table (if any) */}
          {transactions.length > 0 && (
            <section
              className="panel"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ marginTop: 0 }}>Движения наличных за смену</h3>
              {loadingTx && <p className="muted">Загрузка операций…</p>}
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
            </section>
          )}
        </div>
      ) : (
        /* ================= CLOSED SHIFT VIEW ================= */
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
          {/* Previous Closed Shift Summary (if available) */}
          {closedShift && (
            <section
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Итоги последней смены
                  </span>
                  <h3 style={{ margin: '2px 0 0', fontSize: '1.15rem' }}>
                    Смена закрыта{' '}
                    {closedShift.closedAt && formatDate(closedShift.closedAt)}
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    background:
                      (closedShift.discrepancyMinor ?? 0) === 0
                        ? '#f0fdf4'
                        : '#fef2f2',
                    color:
                      (closedShift.discrepancyMinor ?? 0) === 0
                        ? '#166534'
                        : '#991b1b',
                    border: `1px solid ${
                      (closedShift.discrepancyMinor ?? 0) === 0
                        ? '#bbf7d0'
                        : '#fecaca'
                    }`,
                  }}
                >
                  {(closedShift.discrepancyMinor ?? 0) === 0
                    ? 'Сходится (0 сом)'
                    : `Расхождение: ${formatSom(closedShift.discrepancyMinor ?? 0)}`}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '10px',
                }}
              >
                <div>
                  <small className="muted">Выручка за смену</small>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    {formatSom(closedRevenue)}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginTop: '2px',
                    }}
                  >
                    Нал: {formatSom(closedShift.salesCashMinor)} • Карта:{' '}
                    {formatSom(closedShift.salesCardMinor)}
                  </div>
                </div>
                <div>
                  <small className="muted">Сдано в кассу (факт)</small>
                  <div
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: '#065f46',
                    }}
                  >
                    {formatSom(
                      closedShift.actualCashMinor ??
                        closedShift.expectedCashMinor,
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginTop: '2px',
                    }}
                  >
                    Ожидалось: {formatSom(closedShift.expectedCashMinor)}
                  </div>
                </div>
                {(closedShift.cashOutMinor ?? 0) > 0 && (
                  <div>
                    <small className="muted">Расходы кассы</small>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                      {formatSom(closedShift.cashOutMinor ?? 0)}
                    </div>
                  </div>
                )}
              </div>
              {closedShift.comment && (
                <p
                  className="muted"
                  style={{
                    fontSize: '0.825rem',
                    margin: '8px 0 0',
                    fontStyle: 'italic',
                  }}
                >
                  💬 «{closedShift.comment}»
                </p>
              )}
            </section>
          )}

          {/* Open New Shift Form */}
          {!opening.draft.submission && !s.loading && (
            <section
              className="panel form-panel"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                padding: '1.25rem',
              }}
            >
              <h2 style={{ marginTop: 0, fontSize: '1.35rem' }}>
                Открыть смену
              </h2>
              <p
                className="muted"
                style={{ marginTop: '-0.25rem', marginBottom: '1rem' }}
              >
                Укажите начальную сумму наличных в денежном ящике.
              </p>
              <label>
                Начальные наличные, сом
                <input
                  inputMode="decimal"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="0.00"
                />
              </label>
              <button
                className="primary"
                style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
                disabled={opening.busy || opening.blocked || !opening.online}
                onClick={() => void open()}
              >
                Открыть смену
              </button>
            </section>
          )}
        </div>
      )}

      {/* Telegram Owner Settings Card (Always accessible for store owner) */}
      {isOwner && (
        <section style={{ marginTop: '1.5rem' }}>
          <TelegramOwnerSettings shopId={shopId} owner={isOwner} />
        </section>
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
  if (!s.user || !shopId) return null;
  return (
    <ShiftWorkspace
      key={shopId + s.user.userId}
      shopId={shopId}
      userId={s.user.userId}
    />
  );
}
