import { useEffect, useRef } from 'react';
import { formatSom } from '../api/money';

export type ReceivingConfirmationSheetProps = {
  open: boolean;
  onClose: () => void;
  supplier: string;
  setSupplier: (s: string) => void;
  documentNumber: string;
  setDocumentNumber: (n: string) => void;
  receivedOn: string;
  setReceivedOn: (d: string) => void;
  comment: string;
  setComment: (c: string) => void;
  lineCount: number;
  totalUnits: number;
  totalSum: bigint;
  onSubmit: () => Promise<void> | void;
  isSubmitting: boolean;
  isSubmissionPending: boolean;
  error?: string;
  disabled?: boolean;
};

export default function ReceivingConfirmationSheet({
  open,
  onClose,
  supplier,
  setSupplier,
  documentNumber,
  setDocumentNumber,
  receivedOn,
  setReceivedOn,
  comment,
  setComment,
  lineCount,
  totalUnits,
  totalSum,
  onSubmit,
  isSubmitting,
  isSubmissionPending,
  error,
  disabled = false,
}: ReceivingConfirmationSheetProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const safeSum =
    totalSum <= BigInt(Number.MAX_SAFE_INTEGER)
      ? formatSom(Number(totalSum))
      : 'Сумма превышена';

  return (
    <div
      className="pos-sheet-root receiving-confirm-sheet-root"
      role="dialog"
      aria-modal="true"
      aria-label="Подтверждение приёмки"
    >
      <div
        className="pos-sheet-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="pos-sheet-drawer receiving-confirm-drawer"
        ref={drawerRef}
      >
        <div className="pos-sheet-handle" aria-hidden="true" />
        <div className="pos-sheet-head">
          <div className="pos-sheet-head-copy">
            <h2>Подтверждение приёмки</h2>
            <strong className="pos-sheet-total">{safeSum}</strong>
          </div>
          <button
            type="button"
            className="pos-sheet-close"
            aria-label="Закрыть подтверждение приёмки"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="pos-sheet-body receiving-confirm-body">
          <label className="receiving-confirm-field">
            <span>Поставщик</span>
            <div className="receiving-supplier-box">
              <span className="receiving-input-icon" aria-hidden="true">
                🏢
              </span>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                disabled={disabled}
                placeholder="Например, ОсОО «ФудТрейд»"
              />
              {supplier && !disabled && (
                <button
                  type="button"
                  className="receiving-supplier-clear"
                  aria-label="Очистить поставщика"
                  onClick={() => setSupplier('')}
                >
                  ×
                </button>
              )}
            </div>
          </label>

          <div className="receiving-meta-row">
            <label className="receiving-confirm-field">
              <span>Номер накладной</span>
              <div className="receiving-input-wrap">
                <span className="receiving-input-icon" aria-hidden="true">
                  📄
                </span>
                <input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  disabled={disabled}
                  placeholder="ПН-000123"
                />
              </div>
            </label>
            <label className="receiving-confirm-field">
              <span>Дата поставки</span>
              <div className="receiving-input-wrap">
                <span className="receiving-input-icon" aria-hidden="true">
                  📅
                </span>
                <input
                  type="date"
                  value={receivedOn}
                  onChange={(e) => setReceivedOn(e.target.value)}
                  disabled={disabled}
                />
              </div>
            </label>
          </div>

          <label className="receiving-confirm-field">
            <span>Комментарий</span>
            <div className="receiving-input-wrap">
              <span className="receiving-input-icon" aria-hidden="true">
                💬
              </span>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={disabled}
                placeholder="Например, поставка по договору"
              />
            </div>
          </label>

          <div className="receiving-confirm-card">
            <div className="receiving-confirm-card-head">
              <span className="receiving-confirm-card-icon" aria-hidden="true">
                📦
              </span>
              <strong>К приёмке</strong>
            </div>
            <div className="receiving-confirm-card-row">
              <span className="muted">Позиций</span>
              <strong>{lineCount}</strong>
            </div>
            <div className="receiving-confirm-card-row">
              <span className="muted">Всего единиц</span>
              <strong>{totalUnits}</strong>
            </div>
            <div className="receiving-confirm-card-row total">
              <span>Сумма закупки</span>
              <strong className="receiving-confirm-total-amount">
                {safeSum}
              </strong>
            </div>
          </div>

          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}

          <button
            type="button"
            className="button primary receiving-confirm-submit-btn"
            disabled={disabled || isSubmitting || lineCount === 0}
            onClick={() => void onSubmit()}
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
                  : 'Подтвердить и провести'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
