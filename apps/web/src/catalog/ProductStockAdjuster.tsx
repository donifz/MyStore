import { useState } from 'react';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';

export interface ProductStockAdjusterProps {
  shopId: string;
  variantId: string;
  variantName: string;
  physicalCount: number;
  reservedCount: number;
  availableCount: number;
  defaultUnitCostMinor?: number;
  canViewCost?: boolean;
  onStockUpdated: (newStock: {
    physical: number;
    available: number;
    reserved: number;
  }) => void;
  onClose?: () => void;
}

const REASON_PRESETS = [
  { id: 'recount', label: 'Пересчёт' },
  { id: 'surplus', label: 'Оприходование (излишек)' },
  { id: 'defect', label: 'Списание (брак)' },
  { id: 'shortage', label: 'Списание (недостача)' },
  { id: 'custom', label: 'Другая причина…' },
];

export default function ProductStockAdjuster({
  shopId,
  variantId,
  variantName,
  physicalCount,
  reservedCount,
  availableCount,
  defaultUnitCostMinor = 0,
  canViewCost = true,
  onStockUpdated,
  onClose,
}: ProductStockAdjusterProps) {
  const [targetCount, setTargetCount] = useState<number>(physicalCount);
  const [reasonPreset, setReasonPreset] = useState<string>('recount');
  const [customReason, setCustomReason] = useState<string>('');
  const [costInput, setCostInput] = useState<string>(
    defaultUnitCostMinor > 0
      ? (defaultUnitCostMinor / 100).toFixed(2).replace(/\.00$/, '')
      : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const delta = targetCount - physicalCount;
  const newAvailable = targetCount - reservedCount;

  let unitCostMinor = defaultUnitCostMinor;
  if (costInput.trim()) {
    try {
      const parsed = parseSom(costInput);
      if (parsed !== null && parsed >= 0) {
        unitCostMinor = parsed;
      }
    } catch {
      // keep fallback
    }
  }

  const effectiveReason =
    reasonPreset === 'custom'
      ? customReason.trim()
      : REASON_PRESETS.find((r) => r.id === reasonPreset)?.label ||
        'Корректировка остатка';

  const canSubmit =
    !busy &&
    delta !== 0 &&
    targetCount >= reservedCount &&
    (reasonPreset !== 'custom' || customReason.trim().length > 0);

  const applyDelta = (step: number) => {
    setError('');
    setSuccess('');
    setTargetCount((prev) => Math.max(reservedCount, prev + step));
  };

  const handleApply = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setSuccess('');

    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'adj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);

    try {
      await api(`/shops/${shopId}/inventory/counts`, {
        method: 'POST',
        key: idempotencyKey,
        body: {
          variantId,
          expectedQuantity: physicalCount,
          countedQuantity: targetCount,
          unitCostMinor: delta > 0 ? unitCostMinor : 0,
          reason: effectiveReason,
        },
      });

      const updatedPhysical = targetCount;
      const updatedAvailable = targetCount - reservedCount;

      setSuccess(
        `Остаток успешно изменён: ${targetCount} шт. (${delta > 0 ? '+' : ''}${delta} шт.). Документ инвентаризации зафиксирован.`,
      );
      onStockUpdated({
        physical: updatedPhysical,
        available: updatedAvailable,
        reserved: reservedCount,
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="product-stock-adjuster">
      <div className="product-stock-adjuster__header">
        <div>
          <h3>Изменение остатка</h3>
        </div>
        {onClose && (
          <button
            type="button"
            className="product-stock-adjuster__close"
            aria-label="Закрыть"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="product-stock-adjuster__alert error">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="product-stock-adjuster__alert success">
          {success}
        </div>
      )}

      <div className="product-stock-adjuster__current-info">
        <div className="product-stock-adjuster__stat">
          <span className="muted">Было:</span>
          <strong>{physicalCount} шт.</strong>
        </div>
        <div className="product-stock-adjuster__stat">
          <span className="muted">Доступно:</span>
          <strong>{availableCount} шт.</strong>
        </div>
        {reservedCount > 0 && (
          <div className="product-stock-adjuster__stat is-warn">
            <span className="muted">Резерв:</span>
            <strong>{reservedCount} шт.</strong>
          </div>
        )}
      </div>

      <div className="product-stock-adjuster__controls">
        <div className="product-stock-adjuster__stepper-row">
          <button
            type="button"
            className="product-stock-adjuster__step-btn"
            aria-label="Уменьшить на 1"
            disabled={busy || targetCount <= reservedCount}
            onClick={() => applyDelta(-1)}
          >
            −
          </button>
          <div className="product-stock-adjuster__input-wrap">
            <input
              type="number"
              className="product-stock-adjuster__input"
              aria-label="Фактическое количество"
              min={reservedCount}
              value={targetCount}
              disabled={busy}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setTargetCount(Math.max(0, val));
                }
              }}
            />
            <span className="product-stock-adjuster__unit">шт.</span>
          </div>
          <button
            type="button"
            className="product-stock-adjuster__step-btn"
            aria-label="Увеличить на 1"
            disabled={busy}
            onClick={() => applyDelta(1)}
          >
            +
          </button>
        </div>

        <div
          className="product-stock-adjuster__chips"
          aria-label="Быстрый выбор"
        >
          <button
            type="button"
            className="product-stock-chip"
            disabled={busy}
            onClick={() => applyDelta(1)}
          >
            +1
          </button>
          <button
            type="button"
            className="product-stock-chip"
            disabled={busy}
            onClick={() => applyDelta(5)}
          >
            +5
          </button>
          <button
            type="button"
            className="product-stock-chip"
            disabled={busy}
            onClick={() => applyDelta(10)}
          >
            +10
          </button>
          <button
            type="button"
            className="product-stock-chip"
            disabled={busy || targetCount <= reservedCount}
            onClick={() => applyDelta(-1)}
          >
            −1
          </button>
          <button
            type="button"
            className="product-stock-chip"
            disabled={busy || targetCount <= reservedCount}
            onClick={() => applyDelta(-5)}
          >
            −5
          </button>
          {targetCount !== physicalCount && (
            <button
              type="button"
              className="product-stock-chip is-reset"
              disabled={busy}
              onClick={() => {
                setTargetCount(physicalCount);
                setError('');
                setSuccess('');
              }}
            >
              Сброс
            </button>
          )}
        </div>

        <div
          className={`product-stock-adjuster__delta-badge ${
            delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : 'is-zero'
          }`}
        >
          {delta > 0 && (
            <span>
              📈 <strong>+{delta} шт.</strong> (приход)
            </span>
          )}
          {delta < 0 && (
            <span>
              📉 <strong>{delta} шт.</strong> (списание)
            </span>
          )}
          {delta === 0 && <span>Без изменений</span>}
        </div>
      </div>

      {delta > 0 && canViewCost && (
        <div className="product-stock-adjuster__field">
          <label htmlFor="adjuster-cost-input">Закупка, сом:</label>
          <input
            id="adjuster-cost-input"
            type="text"
            className="product-stock-adjuster__text-input"
            value={costInput}
            placeholder="0.00"
            disabled={busy}
            onChange={(e) => setCostInput(e.target.value)}
          />
        </div>
      )}

      <div className="product-stock-adjuster__field">
        <label htmlFor="adjuster-reason-preset">Причина:</label>
        <select
          id="adjuster-reason-preset"
          className="product-stock-adjuster__select"
          value={reasonPreset}
          disabled={busy}
          onChange={(e) => setReasonPreset(e.target.value)}
        >
          {REASON_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {reasonPreset === 'custom' && (
          <input
            type="text"
            className="product-stock-adjuster__text-input"
            placeholder="Укажите причину"
            maxLength={500}
            value={customReason}
            disabled={busy}
            onChange={(e) => setCustomReason(e.target.value)}
          />
        )}
      </div>

      <div className="product-stock-adjuster__actions">
        <button
          type="button"
          className="primary button"
          disabled={!canSubmit}
          onClick={handleApply}
        >
          {busy
            ? 'Проведение документа…'
            : delta > 0
              ? `Оприходовать +${delta} шт.`
              : delta < 0
                ? `Списать ${Math.abs(delta)} шт.`
                : 'Укажите новое количество'}
        </button>
        {onClose && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}
