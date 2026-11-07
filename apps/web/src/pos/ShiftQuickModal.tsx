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
  const [validation, setValidation] = useState('');
  const busy = opening.busy || closing.busy;
  const pending = shift
    ? closing.draft.submission
    : opening.draft.submission;
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

  async function submit() {
    if (busy) return;
    setValidation('');
    if (shift) {
      let expenseMinor = 0;
      if (!closing.draft.submission && expense.trim()) {
        try {
          expenseMinor = parseSom(expense);
          if (expenseMinor < 0) throw new Error('Расход не может быть отрицательным');
          if (expenseMinor > shift.expectedCashMinor) {
            setValidation('Расход превышает наличные в кассе.');
            return;
          }
        } catch {
          setValidation('Укажите корректную сумму расхода.');
          return;
        }
      }
      const result = await closing.send(
        `/shops/${shopId}/pos/shifts/${shift.id}/close`,
        closing.draft.submission?.body ??
          (expenseMinor ? { expenseMinor } : {}),
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
                  <strong>{formatSom(shift.salesCashMinor - shift.refundsCashMinor)}</strong>
                </div>
                <div>
                  <span>Безналичные</span>
                  <strong>{formatSom(shift.salesCardMinor - shift.refundsCardMinor)}</strong>
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
              <label className="quick-shift-expense">
                <span>Расход за сегодня <em>необязательно</em></span>
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
                <small>Если были траты из кассы — укажите сумму. Она сохранится отдельно.</small>
              </label>
              <div className="quick-shift-expected">
                <span>Ожидаемые наличные после расхода</span>
                <strong>
                  {formatSom(
                    shift.expectedCashMinor -
                      (pending
                        ? Number(pending.body.expenseMinor ?? 0)
                        : (() => {
                            try {
                              return expense.trim() ? parseSom(expense) : 0;
                            } catch {
                              return 0;
                            }
                          })()),
                  )}
                </strong>
              </div>
            </>
          ) : (
            <div className="quick-shift-welcome">
              <span className="quick-shift-welcome-icon" aria-hidden="true">✓</span>
              <strong>Всё готово к продажам</strong>
              <p>
                Откройте смену одним нажатием. Система сама учтёт
                продажи, оплаты и возвраты.
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
              Предыдущее действие не подтверждено. Повторим его без дублирования.
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
