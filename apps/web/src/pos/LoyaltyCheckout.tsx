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
  const maxPoints = Math.floor(totalMinor / 500);
  return (
    <div className="pos-credit-enrollment">
      <strong>Бонусная карта покупателя</strong>
      <p className="muted">
        Покупатель открывает «Мой QR» в кабинете MyStore. QR действителен 2
        минуты и используется только один раз.
      </p>
      <label>
        Код карты
        <input
          disabled={disabled}
          type="text"
          autoComplete="off"
          value={token}
          maxLength={43}
          placeholder="Сканируйте QR или введите код"
          onChange={(e) => setToken(e.target.value.trim())}
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setScanning((value) => !value)}
      >
        {scanning ? 'Закрыть сканер' : 'Сканировать QR покупателя'}
      </button>
      {scanning && (
        <CameraScanner
          onClose={() => setScanning(false)}
          onScan={(value) => {
            if (/^[A-Za-z0-9_-]{43}$/.test(value)) setToken(value);
            else setToken('');
            setScanning(false);
          }}
        />
      )}
      <label>
        Списать баллов (не более 20% стоимости)
        <input
          type="number"
          min="0"
          max={maxPoints}
          step="1"
          disabled={disabled || !token}
          value={points}
          onChange={(e) => {
            const num = Number(e.target.value);
            setPoints(Number.isSafeInteger(num) && num >= 0 ? num : 0);
          }}
        />
      </label>
      <p className="muted">
        1 балл = 1 сом. До {maxPoints} баллов за эту покупку. Баланс и
        действительность QR проверяет сервер.
      </p>
    </div>
  );
}
