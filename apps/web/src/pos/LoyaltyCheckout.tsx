import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import CameraScanner from '../scanner/CameraScanner';
import { shouldKeepScannerFocus } from '../scanner/scan-focus';
import PaymentIcon from './PaymentIcon';

type OpenDebt = {
  saleId: string;
  totalMinor: number;
  paidMinor: number;
  debtMinor: number;
  dueOn: string;
  createdAt: string;
};

export type CustomerQrProfile = {
  customerId: string;
  name: string;
  phone: string;
  bonusPoints: number;
  totalDebtMinor: number;
  openDebts: OpenDebt[];
};

type Props = {
  shopId: string;
  shiftId?: string;
  token: string;
  setToken: (value: string) => void;
  points: number;
  setPoints: (value: number) => void;
  totalMinor: number;
  disabled: boolean;
  onDebtRepaid?: () => void;
  onProfileLoaded?: (profile: CustomerQrProfile | null) => void;
};

export default function LoyaltyCheckout({
  shopId,
  shiftId,
  token,
  setToken,
  points,
  setPoints,
  totalMinor,
  disabled,
  onDebtRepaid,
  onProfileLoaded,
}: Props) {
  const [scanning, setScanning] = useState(false);
  const [tsdArmed, setTsdArmed] = useState(() => shouldKeepScannerFocus());
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [profile, setProfile] = useState<CustomerQrProfile | null>(null);

  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'cash' | 'card'>('cash');
  const [repayBusy, setRepayBusy] = useState(false);
  const [repayError, setRepayError] = useState('');
  const [repaySuccess, setRepaySuccess] = useState('');

  const qrReady = /^[A-Za-z0-9_-]{43}$/.test(token);
  // One point = one som; redemption is at most 20% of the receipt.
  const receiptMaxPoints = Math.floor(totalMinor / 500);
  const availableBonusPoints = profile
    ? Math.min(receiptMaxPoints, profile.bonusPoints)
    : receiptMaxPoints;

  const fetchProfile = useCallback(
    async (qrToken: string) => {
      if (!shopId || !/^[A-Za-z0-9_-]{43}$/.test(qrToken)) {
        setProfile(null);
        setLookupError('');
        onProfileLoaded?.(null);
        return;
      }
      setLookupLoading(true);
      setLookupError('');
      try {
        const res = await api<CustomerQrProfile>(
          `/shops/${shopId}/pos/loyalty/lookup`,
          {
            method: 'POST',
            body: { token: qrToken },
          },
        );
        setProfile(res);
        onProfileLoaded?.(res);
      } catch (err) {
        setProfile(null);
        onProfileLoaded?.(null);
        if (err instanceof ApiError && err.status >= 500) {
          setLookupError(
            err.message && err.message !== 'Ошибка сервера'
              ? `${err.message} (${err.status})`
              : `${errorText(err)} (код ${err.status})`,
          );
        } else {
          setLookupError(errorText(err));
        }
      } finally {
        setLookupLoading(false);
      }
    },
    [shopId, onProfileLoaded],
  );

  useEffect(() => {
    if (!qrReady) {
      setProfile(null);
      setLookupError('');
      onProfileLoaded?.(null);
      return;
    }
    void fetchProfile(token);
  }, [qrReady, token, fetchProfile, onProfileLoaded]);

  async function handleRepayDebt() {
    if (!profile || profile.totalDebtMinor <= 0 || repayBusy) return;
    if (!shiftId) {
      setRepayError('Откройте смену, чтобы принять оплату долга');
      return;
    }
    const parsed = parseSom(repayAmount);
    if (parsed === null || parsed <= 0n) {
      setRepayError('Введите корректную сумму погашения');
      return;
    }
    const requestedMinor = Number(parsed);
    if (requestedMinor > profile.totalDebtMinor) {
      setRepayError(
        `Сумма больше общего долга (${formatSom(profile.totalDebtMinor)})`,
      );
      return;
    }

    setRepayBusy(true);
    setRepayError('');
    setRepaySuccess('');
    let remaining = requestedMinor;
    let repaidTotal = 0;

    try {
      for (const debt of profile.openDebts) {
        if (remaining <= 0) break;
        const chunk = Math.min(remaining, debt.debtMinor);
        if (chunk <= 0) continue;
        await api(
          `/shops/${shopId}/pos/credit-sales/${debt.saleId}/repayments`,
          {
            method: 'POST',
            key: crypto.randomUUID(),
            body: {
              shiftId,
              method: repayMethod,
              amountMinor: chunk,
            },
          },
        );
        remaining -= chunk;
        repaidTotal += chunk;
      }
      setRepayAmount('');
      setRepaySuccess(`Долг погашен на ${formatSom(repaidTotal)}`);
      await fetchProfile(token);
      onDebtRepaid?.();
    } catch (err) {
      setRepayError(errorText(err));
    } finally {
      setRepayBusy(false);
    }
  }

  function armTsdScanner() {
    setScanning(false);
    setTsdArmed(true);
    requestAnimationFrame(() => {
      codeInputRef.current?.focus();
      codeInputRef.current?.select();
    });
  }

  const initials = profile
    ? profile.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : '';

  return (
    <div className="pos-loyalty-checkout">
      <div className="pos-loyalty-scanner-card">
        <div className="pos-loyalty-scanner-status">
          <span
            className={`pos-loyalty-status-pill${
              qrReady ? ' is-success' : tsdArmed && !scanning ? ' is-armed' : ''
            }`}
          >
            <span className="pos-loyalty-status-dot" aria-hidden="true" />
            {qrReady
              ? 'Карта клиента считана'
              : scanning
                ? 'Камера активна — наведите на QR'
                : tsdArmed
                  ? 'ТСД / USB-сканер готов'
                  : 'Выберите способ сканирования'}
          </span>
        </div>

        <div className="pos-loyalty-scan-actions">
          <button
            type="button"
            className={`pos-loyalty-scan${scanning ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => {
              setScanning((current) => !current);
              setTsdArmed(false);
            }}
          >
            <PaymentIcon name={scanning ? 'close' : 'qr'} size={18} />
            <span>{scanning ? 'Закрыть камеру' : 'Сканировать QR'}</span>
          </button>
          <button
            type="button"
            className={`pos-loyalty-tsd${tsdArmed && !scanning ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={armTsdScanner}
          >
            <PaymentIcon name="scanner" size={18} />
            <span>Сканер / ТСД</span>
          </button>
        </div>

        <div
          className={`pos-loyalty-code-row${tsdArmed && !scanning ? ' is-armed' : ''}`}
        >
          <input
            ref={codeInputRef}
            aria-label="Код карты покупателя"
            type="text"
            autoFocus={shouldKeepScannerFocus()}
            autoComplete="off"
            disabled={disabled}
            maxLength={43}
            value={token}
            onFocus={() => setTsdArmed(true)}
            onBlur={() => setTsdArmed(false)}
            onChange={(e) => {
              setRepaySuccess('');
              setRepayError('');
              setToken(e.target.value.trim());
            }}
            placeholder="Поднесите к ТСД или введите код карты"
          />
          {token && (
            <button
              type="button"
              className="pos-loyalty-code-clear"
              aria-label="Очистить код"
              disabled={disabled}
              onClick={() => {
                setRepaySuccess('');
                setRepayError('');
                setToken('');
                setPoints(0);
                armTsdScanner();
              }}
            >
              <PaymentIcon name="close" size={15} />
            </button>
          )}
        </div>
      </div>

      {scanning && (
        <CameraScanner
          onClose={() => setScanning(false)}
          onScan={(value) => {
            setRepaySuccess('');
            setRepayError('');
            const trimmed = value.trim();
            if (/^[A-Za-z0-9_-]{43}$/.test(trimmed)) {
              setLookupError('');
              setToken(trimmed);
            } else {
              setToken('');
              setLookupError('Некорректный QR-код карты покупателя');
            }
            setScanning(false);
          }}
        />
      )}

      {lookupLoading && (
        <p className="pos-loyalty-hint" role="status">
          Поиск карты покупателя…
        </p>
      )}

      {lookupError && (
        <p className="error" role="alert">
          {lookupError}
        </p>
      )}

      {qrReady && !lookupLoading && !lookupError && !profile && (
        <span className="pos-loyalty-ok" role="status">
          <PaymentIcon name="check" size={15} />
          QR считан
        </span>
      )}

      {profile && (
        <div className="pos-customer-card" aria-label="Карта покупателя">
          <div className="pos-customer-card-head">
            <div className="pos-customer-identity">
              {initials && (
                <span className="pos-customer-avatar" aria-hidden="true">
                  {initials}
                </span>
              )}
              <div>
                <strong>{profile.name}</strong>
                {profile.phone && <span>{profile.phone}</span>}
              </div>
            </div>
            <span className="pos-customer-verified">
              <PaymentIcon name="check" size={14} />
              Подтверждён
            </span>
          </div>

          <div className="pos-customer-stats">
            <div className="pos-customer-stat pos-customer-stat--bonus">
              <span>Бонусы</span>
              <strong>{profile.bonusPoints} б.</strong>
            </div>
            <div
              className={`pos-customer-stat ${
                profile.totalDebtMinor > 0
                  ? 'pos-customer-stat--debt'
                  : 'pos-customer-stat--clear'
              }`}
            >
              <span>Текущий долг</span>
              <strong>
                {profile.totalDebtMinor > 0
                  ? formatSom(profile.totalDebtMinor)
                  : 'Нет долга'}
              </strong>
            </div>
          </div>

          {profile.totalDebtMinor > 0 && (
            <div className="pos-debt-repay-box">
              <div className="pos-debt-repay-head">
                <strong>Погашение долга</strong>
                <button
                  type="button"
                  className="pos-debt-fill-all"
                  disabled={repayBusy}
                  onClick={() =>
                    setRepayAmount(
                      (profile.totalDebtMinor / 100).toFixed(
                        profile.totalDebtMinor % 100 === 0 ? 0 : 2,
                      ),
                    )
                  }
                >
                  Весь долг
                </button>
              </div>

              <div
                className="pos-debt-methods"
                role="group"
                aria-label="Способ оплаты долга"
              >
                <button
                  type="button"
                  className={repayMethod === 'cash' ? 'is-active' : ''}
                  disabled={repayBusy}
                  onClick={() => setRepayMethod('cash')}
                >
                  <PaymentIcon name="cash" size={16} />
                  Наличные
                </button>
                <button
                  type="button"
                  className={repayMethod === 'card' ? 'is-active' : ''}
                  disabled={repayBusy}
                  onClick={() => setRepayMethod('card')}
                >
                  <PaymentIcon name="card" size={16} />
                  Карта / QR
                </button>
              </div>

              <div className="pos-debt-repay-row">
                <input
                  aria-label="Сумма погашения долга, сом"
                  inputMode="decimal"
                  type="text"
                  placeholder="Сумма, сом"
                  disabled={repayBusy}
                  value={repayAmount}
                  onChange={(e) => {
                    setRepayError('');
                    setRepayAmount(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="pos-debt-repay-submit"
                  disabled={repayBusy || !repayAmount.trim()}
                  onClick={() => void handleRepayDebt()}
                >
                  {repayBusy ? 'Проводим…' : 'Погасить'}
                </button>
              </div>
            </div>
          )}

          {repayError && (
            <p className="error" role="alert">
              {repayError}
            </p>
          )}
          {repaySuccess && (
            <p className="pos-loyalty-ok" role="status">
              <PaymentIcon name="check" size={15} />
              {repaySuccess}
            </p>
          )}
        </div>
      )}

      <div className="pos-loyalty-points-card">
        <div className="pos-loyalty-points-head">
          <label htmlFor="pos-loyalty-points-input">Списать баллов</label>
          <span className="pos-loyalty-points-rate">
            {points > 0 ? `−${formatSom(points * 100)}` : '1 балл = 1 сом'}
          </span>
        </div>
        <div className="pos-loyalty-points-row">
          <input
            id="pos-loyalty-points-input"
            aria-label="Списать баллов"
            inputMode="numeric"
            type="number"
            min="0"
            max={availableBonusPoints}
            step="1"
            disabled={disabled || !qrReady || totalMinor <= 0}
            value={String(points)}
            onChange={(e) => {
              const cleaned = e.target.value
                .replace(/\D/g, '')
                .replace(/^0+(?=\d)/, '');
              if (e.target.value !== cleaned) e.currentTarget.value = cleaned;
              const num = cleaned ? Number(cleaned) : 0;
              setPoints(Number.isSafeInteger(num) && num >= 0 ? num : 0);
            }}
          />
          <button
            type="button"
            className="pos-loyalty-max-btn"
            disabled={disabled || !qrReady || availableBonusPoints <= 0}
            onClick={() => setPoints(availableBonusPoints)}
          >
            Макс. {availableBonusPoints}
          </button>
        </div>
        <small className="pos-loyalty-hint">
          {!qrReady
            ? 'Отсканируйте карту клиента, чтобы списать баллы · до 20% чека'
            : 'Только подтверждённый покупатель · до 20% чека'}
        </small>
      </div>
    </div>
  );
}
