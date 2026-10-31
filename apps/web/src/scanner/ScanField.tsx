import { useCallback, useId, useRef, useState } from 'react';
import CameraScanner from './CameraScanner';
export default function ScanField({
  onScan,
  disabled = false,
  onManualAdd,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
  onManualAdd?: () => void;
}) {
  const [code, setCode] = useState(''),
    input = useRef<HTMLInputElement>(null),
    [camera, setCamera] = useState(false),
    inputId = useId();
  const scan = useCallback(
    (value: string) => {
      onScan(value);
      setCode('');
      setCamera(false);
    },
    [onScan],
  );
  return (
    <div className="scan-field">
      <label htmlFor={inputId} className="scan-field-label">
        Сканировать штрихкод
      </label>
      <div className="scan-field-bar">
        <div className="scan-field-input">
          <svg
            className="scan-field-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />
          </svg>
          <input
            id={inputId}
            ref={input}
            autoFocus
            autoComplete="off"
            value={code}
            disabled={disabled}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const value = code.trim();
                if (value) scan(value);
                setCode('');
              }
            }}
            placeholder="Сканер или код + Enter"
          />
        </div>
        <button
          type="button"
          className="scan-field-btn"
          disabled={disabled}
          onClick={() => input.current?.focus()}
        >
          <svg
            className="scan-field-btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          </svg>
          <span>Фокус для сканера</span>
        </button>
        <button
          type="button"
          className="scan-field-btn"
          disabled={disabled}
          onClick={() => setCamera(true)}
        >
          <svg
            className="scan-field-btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span>Сканировать камерой</span>
        </button>
      </div>
      <div className="scan-field-foot">
        <div className="scan-field-hints">
          <p className="muted">
            USB-сканер вводит код как клавиатура. Один скан — одна единица.
          </p>
          <div className="scan-field-shortcuts" aria-hidden="true">
            <span>
              <kbd>Enter</kbd> — добавить товар
            </span>
            <span>
              <kbd>+</kbd> — увеличить количество
            </span>
            <span>
              <kbd>−</kbd> — уменьшить количество
            </span>
          </div>
        </div>
        {onManualAdd && (
          <button
            type="button"
            className="receiving-manual-btn"
            disabled={disabled}
            onClick={onManualAdd}
          >
            <span className="receiving-manual-plus" aria-hidden="true">
              +
            </span>
            Добавить вручную
          </button>
        )}
      </div>
      {camera && (
        <CameraScanner onScan={scan} onClose={() => setCamera(false)} />
      )}
    </div>
  );
}
