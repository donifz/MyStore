import { useEffect, useRef } from 'react';
import { formatSom } from '../api/money';

const wholeSom = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

export type PaymentBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  method: 'cash' | 'card';
  setMethod: (m: 'cash' | 'card') => void;
  received: string;
  setReceived: (v: string) => void;
  totalText: string;
  totalMinor: number;
  changeMinor: bigint | null;
  receivedMinor: number | null;
  receivedError?: string;
  quickAmounts: number[];
  canSubmit: boolean;
  isSubmitting: boolean;
  isSubmissionPending: boolean;
  onSubmit: () => void;
  error?: string;
  success?: string;
  onNewReceipt?: () => void;
};

export default function PaymentBottomSheet({
  open,
  onClose,
  method,
  setMethod,
  received,
  setReceived,
  totalText,
  totalMinor,
  changeMinor,
  receivedMinor,
  receivedError,
  quickAmounts,
  canSubmit,
  isSubmitting,
  isSubmissionPending,
  onSubmit,
  error,
  success,
  onNewReceipt,
}: PaymentBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isShort = changeMinor !== null && changeMinor < 0n;
  const isChange = changeMinor !== null && changeMinor >= 0n;

  return (
    <div
      className="pos-sheet-root"
      role="dialog"
      aria-modal="true"
      aria-label="Оплата чека"
    >
      <div
        className="pos-sheet-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="pos-sheet-drawer" ref={sheetRef}>
        <div className="pos-sheet-handle" aria-hidden="true" />
        <div className="pos-sheet-head">
          <div className="pos-sheet-head-copy">
            <h2>Оплата чека</h2>
            <strong className="pos-sheet-total">К оплате: {totalText}</strong>
          </div>
          <button
            type="button"
            className="pos-sheet-close"
            aria-label="Закрыть оплату"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="pos-sheet-success" role="status">
            <div className="pos-sheet-success-icon" aria-hidden="true">
              ✓
            </div>
            <h3>Продажа проведена</h3>
            <p className="muted">{success}</p>
            <button
              type="button"
              className="button primary pos-sheet-new-btn"
              onClick={() => {
                onClose();
                onNewReceipt?.();
              }}
            >
              Новый чек
            </button>
          </div>
        ) : (
          <div className="pos-sheet-body">
            <fieldset className="pos-methods">
              <legend className="pos-sheet-section-title">Способ оплаты</legend>
              <label
                className={
                  method === 'cash' ? 'pos-method selected' : 'pos-method'
                }
              >
                <input
                  type="radio"
                  name="bottom-sheet-method"
                  value="cash"
                  checked={method === 'cash'}
                  onChange={() => setMethod('cash')}
                />
                <svg
                  className="pos-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  aria-hidden="true"
                >
                  <rect x="2.5" y="6" width="19" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2.7" />
                  <path d="M6 9.5h.01M18 14.5h.01" />
                </svg>
                <span>Наличные</span>
              </label>
              <label
                className={
                  method === 'card' ? 'pos-method selected' : 'pos-method'
                }
              >
                <input
                  type="radio"
                  name="bottom-sheet-method"
                  value="card"
                  checked={method === 'card'}
                  onChange={() => setMethod('card')}
                />
                <svg
                  className="pos-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  aria-hidden="true"
                >
                  <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
                  <path d="M2.5 10h19M6.5 14.5h4" />
                </svg>
                <span>Банковская карта</span>
              </label>
            </fieldset>

            {method === 'cash' && (
              <div className="pos-sheet-cash-section">
                <label className="pos-received">
                  Получено от покупателя, сом
                  <input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                  />
                </label>

                <div className="pos-quick">
                  <span className="pos-quick-label">Быстрые суммы</span>
                  <div className="pos-quick-buttons">
                    <button
                      type="button"
                      className={
                        receivedMinor !== null &&
                        receivedMinor === totalMinor &&
                        totalMinor > 0
                          ? 'button secondary pos-quick-button selected'
                          : 'button secondary pos-quick-button'
                      }
                      onClick={() => setReceived((totalMinor / 100).toString())}
                    >
                      Без сдачи
                    </button>
                    {quickAmounts.map((amount) => (
                      <button
                        type="button"
                        key={amount}
                        className={
                          receivedMinor === amount
                            ? 'button secondary pos-quick-button selected'
                            : 'button secondary pos-quick-button'
                        }
                        onClick={() => setReceived((amount / 100).toString())}
                      >
                        {wholeSom.format(amount / 100).replace(/\u00a0/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {receivedError && (
                  <p role="alert" className="error">
                    {receivedError}
                  </p>
                )}

                <div className="pos-totals">
                  <div className="pos-total-tile">
                    <span>К оплате</span>
                    <strong>{totalText}</strong>
                  </div>
                  <div
                    className={
                      isShort
                        ? 'pos-total-tile short'
                        : isChange
                          ? 'pos-total-tile change'
                          : 'pos-total-tile'
                    }
                  >
                    <span>{isShort ? 'Не хватает' : 'Сдача'}</span>
                    <strong>
                      {changeMinor === null
                        ? '—'
                        : formatSom(
                            Number(
                              changeMinor >= 0n ? changeMinor : -changeMinor,
                            ),
                          )}
                    </strong>
                  </div>
                </div>

                {isShort && (
                  <p role="alert" className="notice warning">
                    Внесённой суммы недостаточно для проведения продажи.
                  </p>
                )}
              </div>
            )}

            {method === 'card' && (
              <div className="pos-sheet-card-info">
                <p className="muted">
                  Примите оплату банковской картой через POS-терминал. После
                  успешной авторизации на терминале нажмите кнопку проведения
                  продажи.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}

            <button
              type="button"
              className="pos-submit pos-sheet-submit"
              disabled={!canSubmit || isSubmitting}
              onClick={onSubmit}
            >
              <svg
                className="pos-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m8.2 12.2 2.5 2.6 5.2-5.4" />
              </svg>
              <span>
                {isSubmitting
                  ? 'Проведение…'
                  : isSubmissionPending
                    ? 'Повторить исходный запрос'
                    : `Провести продажу — ${totalText}`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
