import { useEffect, useState } from 'react';
import { formatSom, parseSom } from '../api/money';
import type { Shift } from '../api/types';
import { useDocument } from '../drafts/use-document';
import './shift-quick-modal.css';

type Props = {
  shopId: string;
  userId: string;
  shift: Shift | null;
  onClose: () => void;
  onCompleted: () => void;
};

type DetailedExpenseItem = {
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

export default function ShiftQuickModal({
  shopId,
  userId,
  shift,
  onClose,
  onCompleted,
}: Props) {
  const opening = useDocument({ shopId, userId, kind: 'shift-open' });
  const closing = useDocument({ shopId, userId, kind: 'shift-close' });
  const [expense, setExpense] = useState('');
  const [detailedMode, setDetailedMode] = useState(false);
  const [items, setItems] = useState<DetailedExpenseItem[]>(() => {
    return getStoredTemplates(shopId).map((reason) => ({
      reason,
      amount: '',
    }));
  });
  const [validation, setValidation] = useState('');
  const busy = opening.busy || closing.busy;
  const pending = shift ? closing.draft.submission : opening.draft.submission;
  const netSales = shift
    ? shift.salesCashMinor +
      shift.salesCardMinor -
      shift.refundsCashMinor -
      shift.refundsCardMinor
    : 0;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [busy, onClose]);

  function getDetailedExpenses(): {
    itemsToSend: Array<{ reason: string; amountMinor: number }>;
    totalMinor: number;
    error?: string;
  } {
    const active = items.filter(
      (it) => it.reason.trim().length > 0 && it.amount.trim().length > 0,
    );
    const itemsToSend: Array<{ reason: string; amountMinor: number }> = [];
    let total = 0;
    for (const it of active) {
      try {
        const minor = parseSom(it.amount);
        if (minor < 0) {
          return {
            itemsToSend: [],
            totalMinor: 0,
            error: `Расход «${it.reason}» не может быть отрицательным`,
          };
        }
        if (minor > 0) {
          itemsToSend.push({ reason: it.reason.trim(), amountMinor: minor });
          total += minor;
        }
      } catch {
        return {
          itemsToSend: [],
          totalMinor: 0,
          error: `Неверная сумма в расходе «${it.reason}»`,
        };
      }
    }
    return { itemsToSend, totalMinor: total };
  }

  const effectiveExpenseMinor = (() => {
    if (pending) return Number(pending.body.expenseMinor ?? 0);
    if (detailedMode) {
      const res = getDetailedExpenses();
      return res.error ? 0 : res.totalMinor;
    }
    try {
      return expense.trim() ? parseSom(expense) : 0;
    } catch {
      return 0;
    }
  })();

  function updateItemReason(idx: number, newReason: string) {
    setValidation('');
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, reason: newReason } : it)),
    );
  }

  function updateItemAmount(idx: number, newAmount: string) {
    setValidation('');
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, amount: newAmount } : it)),
    );
  }

  function removeItem(idx: number) {
    setValidation('');
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem() {
    setValidation('');
    setItems((prev) => [...prev, { reason: '', amount: '' }]);
  }

  async function submit() {
    if (busy) return;
    setValidation('');
    if (shift) {
      let expenseMinor = 0;
      let expensesToSend:
        Array<{ reason: string; amountMinor: number }> | undefined = undefined;

      if (!closing.draft.submission) {
        if (detailedMode) {
          const res = getDetailedExpenses();
          if (res.error) {
            setValidation(res.error);
            return;
          }
          expenseMinor = res.totalMinor;
          if (res.itemsToSend.length > 0) {
            expensesToSend = res.itemsToSend;
          }
          storeTemplates(
            shopId,
            items.map((it) => it.reason),
          );
        } else if (expense.trim()) {
          try {
            expenseMinor = parseSom(expense);
            if (expenseMinor < 0)
              throw new Error('Расход не может быть отрицательным');
          } catch {
            setValidation('Укажите корректную сумму расхода.');
            return;
          }
        }
        if (expenseMinor > shift.expectedCashMinor) {
          setValidation('Расход превышает наличные в кассе.');
          return;
        }
      }

      const body =
        closing.draft.submission?.body ??
        (expenseMinor
          ? {
              expenseMinor,
              ...(expensesToSend && expensesToSend.length > 0
                ? { expenses: expensesToSend }
                : {}),
            }
          : {});

      const result = await closing.send(
        `/shops/${shopId}/pos/shifts/${shift.id}/close`,
        body,
      );
      if (result) onCompleted();
    } else {
      const result = await opening.send(
        `/shops/${shopId}/pos/shifts`,
        opening.draft.submission?.body ?? {},
      );
      if (result) onCompleted();
    }
  }

  return (
    <div className="quick-shift-overlay" role="presentation">
      <button
        type="button"
        className="quick-shift-backdrop"
        aria-label="Закрыть окно смены"
        disabled={busy}
        onClick={onClose}
      />
      <section
        className="quick-shift-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-shift-title"
      >
        <div className="quick-shift-handle" aria-hidden="true" />
        <header className="quick-shift-header">
          <div>
            <span className="quick-shift-eyebrow">
              {shift ? 'Итоги работы' : 'Начало рабочего дня'}
            </span>
            <h2 id="quick-shift-title">
              {shift ? 'Закрыть смену' : 'Открыть смену'}
            </h2>
          </div>
          <button
            type="button"
            className="quick-shift-x"
            aria-label="Закрыть окно"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="quick-shift-content">
          {shift ? (
            <>
              <div className="quick-shift-hero">
                <span>Продажи за смену</span>
                <strong>{formatSom(netSales)}</strong>
                <small>По проведённым чекам с учётом возвратов</small>
              </div>
              <div className="quick-shift-totals">
                <div>
                  <span>Наличные</span>
                  <strong>
                    {formatSom(shift.salesCashMinor - shift.refundsCashMinor)}
                  </strong>
                </div>
                <div>
                  <span>Безналичные</span>
                  <strong>
                    {formatSom(shift.salesCardMinor - shift.refundsCardMinor)}
                  </strong>
                </div>
                <div>
                  <span>Погашение долгов</span>
                  <strong>
                    {formatSom(
                      (shift.repaymentsCashMinor ?? 0) +
                        (shift.repaymentsCardMinor ?? 0),
                    )}
                  </strong>
                </div>
              </div>

              <div className="quick-shift-expense-container">
                <div className="quick-shift-expense-header">
                  <span className="quick-shift-expense-title">
                    Расход за сегодня <em>необязательно</em>
                  </span>
                  {!pending && (
                    <button
                      type="button"
                      className="quick-shift-toggle-btn"
                      onClick={() => {
                        setDetailedMode(!detailedMode);
                        setValidation('');
                      }}
                    >
                      {detailedMode ? 'Одной суммой' : 'Детальный расход'}
                    </button>
                  )}
                </div>

                {detailedMode && !pending ? (
                  <div className="quick-shift-detailed-list">
                    {items.map((item, index) => (
                      <div key={index} className="quick-shift-detailed-row">
                        <input
                          type="text"
                          className="quick-shift-item-reason"
                          placeholder="Статья (за что)"
                          value={item.reason}
                          aria-label={`Статья расхода #${index + 1}`}
                          onChange={(e) =>
                            updateItemReason(index, e.target.value)
                          }
                          disabled={busy}
                        />
                        <div className="quick-shift-item-amount-wrap">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="quick-shift-item-amount"
                            placeholder="0"
                            aria-label={`Сумма для ${item.reason || `статьи #${index + 1}`}`}
                            value={item.amount}
                            onChange={(e) =>
                              updateItemAmount(index, e.target.value)
                            }
                            disabled={busy}
                          />
                          <span>сом</span>
                        </div>
                        <button
                          type="button"
                          className="quick-shift-item-remove"
                          title="Удалить за этот день"
                          aria-label={`Удалить ${item.reason || 'статью'}`}
                          onClick={() => removeItem(index)}
                          disabled={busy}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className="quick-shift-detailed-footer">
                      <button
                        type="button"
                        className="quick-shift-add-btn"
                        onClick={addItem}
                        disabled={busy}
                      >
                        + Добавить статью
                      </button>
                      {effectiveExpenseMinor > 0 && (
                        <span className="quick-shift-detailed-sum">
                          Итого:{' '}
                          <strong>{formatSom(effectiveExpenseMinor)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className="quick-shift-expense">
                    <div className="quick-shift-expense-input">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label="Расход за сегодня"
                        value={
                          pending
                            ? pending.body.expenseMinor
                              ? String(pending.body.expenseMinor / 100)
                              : ''
                            : expense
                        }
                        onChange={(event) => {
                          setExpense(event.target.value);
                          setValidation('');
                        }}
                        disabled={busy || !!pending}
                      />
                      <span>сом</span>
                    </div>
                    <small>
                      Если были траты из кассы — укажите сумму. Она сохранится
                      отдельно.
                    </small>
                  </label>
                )}
              </div>

              <div className="quick-shift-expected">
                <span>Ожидаемые наличные после расхода</span>
                <strong>
                  {formatSom(shift.expectedCashMinor - effectiveExpenseMinor)}
                </strong>
              </div>
            </>
          ) : (
            <div className="quick-shift-welcome">
              <span className="quick-shift-welcome-icon" aria-hidden="true">
                ✓
              </span>
              <strong>Всё готово к продажам</strong>
              <p>
                Откройте смену одним нажатием. Система сама учтёт продажи,
                оплаты и возвраты.
              </p>
              <small>Начальная сумма в кассе — 0 сом.</small>
            </div>
          )}
          {(validation || opening.error || closing.error) && (
            <p role="alert" className="quick-shift-error">
              {validation || opening.error || closing.error}
            </p>
          )}
          {pending && (
            <p className="quick-shift-note" role="status">
              Предыдущее действие не подтверждено. Повторим его без
              дублирования.
            </p>
          )}
          <button
            type="button"
            className="quick-shift-submit"
            disabled={
              busy ||
              opening.blocked ||
              closing.blocked ||
              !opening.online ||
              !closing.online
            }
            onClick={() => void submit()}
          >
            {busy
              ? 'Сохраняем…'
              : pending
                ? 'Повторить действие'
                : shift
                  ? 'Завершить смену'
                  : 'Открыть смену'}
          </button>
          <button
            type="button"
            className="quick-shift-cancel"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </button>
        </div>
      </section>
    </div>
  );
}
