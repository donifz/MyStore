import { useState } from 'react';
import CameraScanner from '../scanner/CameraScanner';

type Props = {
  token: string;
  setToken: (value: string) => void;
  points: number;
  setPoints: (value: number) => void;
  totalMinor: number;
  disabled: boolean;
};

export default function LoyaltyCheckout({
  token,
  setToken,
  points,
  setPoints,
  totalMinor,
  disabled,
}: Props) {
  const [scanning, setScanning] = useState(false);
  // One point = one som; redemption is at most 20% of the receipt.
  const maxPoints = Math.floor(totalMinor / 500);
  const qrReady = /^[A-Za-z0-9_-]{43}$/.test(token);

  return (
    <div className="pos-loyalty-checkout">
      <div className="pos-loyalty-qr-row">
        <button
          type="button"
          className="pos-loyalty-scan"
          disabled={disabled}
          onClick={() => setScanning((current) => !current)}
        >
          {scanning ? 'Закрыть камеру' : 'Сканировать QR'}
        </button>
        <label className="pos-loyalty-code">
          <span className="sr-only">Код карты покупателя</span>
          <input
            aria-label="Код карты покупателя"
            type="text"
            autoComplete="off"
            disabled={disabled}
            maxLength={43}
            value={token}
            onChange={(e) => setToken(e.target.value.trim())}
            placeholder="Или введите код"
          />
        </label>
      </div>
      {scanning && (
        <CameraScanner
          onClose={() => setScanning(false)}
          onScan={(value) => {
            setToken(/^[A-Za-z0-9_-]{43}$/.test(value) ? value : '');
            setScanning(false);
          }}
        />
      )}
      {qrReady && (
        <span className="pos-loyalty-ok" role="status">
          QR считан
        </span>
      )}
      <label className="pos-loyalty-points">
        <span>Списать баллов</span>
        <input
          aria-label="Списать баллов"
          inputMode="numeric"
          type="number"
          min="0"
          max={maxPoints}
          step="1"
          disabled={disabled || !qrReady}
          value={points}
          onChange={(e) => {
            const num = Number(e.target.value);
            setPoints(Number.isSafeInteger(num) && num >= 0 ? num : 0);
          }}
        />
        <span className="pos-loyalty-max">Макс. {maxPoints}</span>
      </label>
      <small className="pos-loyalty-hint">
        Только подтверждённый покупатель · 1 балл = 1 сом · до 20% чека
      </small>
    </div>
  );
}
