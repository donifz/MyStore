import { useState } from 'react';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';

export interface CostRevaluationCardProps {
  shopId: string;
  variantId: string;
  physicalCount: number;
  currentUnitCostMinor?: number;
  currentStockValueMinor?: number;
  onRevalued: (result: {
    newUnitCostMinor: number;
    newValueMinor: number;
  }) => void;
}

export default function CostRevaluationCard({
  shopId,
  variantId,
  physicalCount,
  currentUnitCostMinor,
  currentStockValueMinor,
  onRevalued,
}: CostRevaluationCardProps) {
  const [costText, setCostText] = useState(
    currentUnitCostMinor !== undefined
      ? (currentUnitCostMinor / 100).toFixed(2).replace(/\.00$/, '')
      : '',
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  let parsedUnitCostMinor: number | null = null;
  if (costText.trim()) {
    try {
      const parsed = parseSom(costText);
      if (parsed !== null && parsed >= 0) {
        parsedUnitCostMinor = parsed;
      }
    } catch {
      parsedUnitCostMinor = null;
    }
  }

  const baseStockValueMinor =
    currentStockValueMinor ??
    (currentUnitCostMinor !== undefined
      ? currentUnitCostMinor * physicalCount
      : undefined);

  const previewNewValueMinor =
    parsedUnitCostMinor !== null ? parsedUnitCostMinor * physicalCount : null;
  const previewDeltaMinor =
    previewNewValueMinor !== null && baseStockValueMinor !== undefined
      ? previewNewValueMinor - baseStockValueMinor
      : null;

  const canSubmit =
    !busy &&
    physicalCount > 0 &&
    parsedUnitCostMinor !== null &&
    reason.trim().length > 0;

  async function submit() {
    if (!canSubmit || parsedUnitCostMinor === null) return;
    setBusy(true);
    setError('');
    setSuccess('');

    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'reval-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);

    try {
      const result = await api<{
        newUnitCostMinor: number;
        newValueMinor: number;
      }>(`/shops/${shopId}/inventory/revaluations`, {
        method: 'POST',
        key: idempotencyKey,
        body: {
          variantId,
          unitCostMinor: parsedUnitCostMinor,
          reason: reason.trim(),
        },
      });
      setSuccess(
        `Переоценка зафиксирована: новая закупочная цена ${formatSom(result.newUnitCostMinor)}, стоимость остатка ${formatSom(result.newValueMinor)}.`,
      );
      setReason('');
      onRevalued({
        newUnitCostMinor: result.newUnitCostMinor,
        newValueMinor: result.newValueMinor,
      });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="admin-kit-card"
      aria-label="Корректировка закупочной цены"
    >
      <div className="admin-kit-card-head">
        <div>
          <h2>Корректировка закупочной цены</h2>
          <p className="muted">
            Переоценка остатка с записью документа в журнал и пересчётом
            себестоимости
          </p>
        </div>
      </div>

      {physicalCount <= 0 ? (
        <p className="muted">
          Переоценка доступна только при наличии остатка ({'>'} 0 шт.). При
          нулевом остатке закупочная цена задаётся следующей приёмкой.
        </p>
      ) : (
        <div className="stack" style={{ gap: '0.75rem' }}>
          <div className="product-detail-stock-grid">
            <div className="product-detail-stock-tile">
              <span>Текущая закупочная</span>
              <strong>
                {currentUnitCostMinor !== undefined
                  ? formatSom(currentUnitCostMinor)
                  : '—'}
              </strong>
            </div>
            <div className="product-detail-stock-tile">
              <span>Текущая стоимость остатка</span>
              <strong>
                {baseStockValueMinor !== undefined
                  ? formatSom(baseStockValueMinor)
                  : '—'}
              </strong>
            </div>
          </div>

          <label>
            Новая закупочная цена, сом
            <input
              type="text"
              inputMode="decimal"
              value={costText}
              onChange={(event) => {
                setCostText(event.target.value);
                setError('');
                setSuccess('');
              }}
              placeholder="Например, 350"
            />
          </label>

          <label>
            Причина переоценки
            <input
              type="text"
              maxLength={500}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError('');
                setSuccess('');
              }}
              placeholder="Например, ошибка приёмки или переоценка поставщика"
            />
          </label>

          {previewNewValueMinor !== null && (
            <p className="muted" style={{ margin: 0 }}>
              Новая стоимость остатка ({physicalCount} шт.):{' '}
              <strong>{formatSom(previewNewValueMinor)}</strong>
              {previewDeltaMinor !== null && (
                <>
                  {' '}
                  (разница:{' '}
                  <strong>
                    {previewDeltaMinor >= 0 ? '+' : '−'}
                    {formatSom(Math.abs(previewDeltaMinor))}
                  </strong>
                  )
                </>
              )}
            </p>
          )}

          {error && (
            <p role="alert" className="error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="admin-kit-status" style={{ margin: 0 }}>
              {success}
            </p>
          )}

          <div>
            <button
              type="button"
              className="primary"
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              {busy ? 'Сохранение…' : 'Переоценить остаток'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
