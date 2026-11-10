import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
    [isFocused, setIsFocused] = useState(true),
    input = useRef<HTMLInputElement>(null),
    [camera, setCamera] = useState(false),
    inputId = useId();

  useEffect(() => {
    if (disabled || camera) return;
    const keepFocus = () => {
      if (!disabled && !camera) {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        requestAnimationFrame(() => {
          const currentActive = document.activeElement;
          if (
            currentActive &&
            (currentActive.tagName === 'INPUT' ||
              currentActive.tagName === 'TEXTAREA' ||
              currentActive.tagName === 'SELECT' ||
              currentActive.getAttribute('contenteditable') === 'true')
          ) {
            return;
          }
          input.current?.focus({ preventScroll: true });
          setIsFocused(true);
        });
      }
    };

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], .receiving-product-sheet-root, .receiving-manual-picker, .receiving-confirm-sheet-root, .pos-sheet-root, [role="dialog"]',
        )
      ) {
        return;
      }
      keepFocus();
    };

    const handleWindowFocus = (event: FocusEvent) => {
      if (event.target !== window && event.target !== document) return;
      keepFocus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        keepFocus();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [disabled, camera]);

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
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
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
          className={`scan-field-btn pos-tool pos-tool-scanner${isFocused ? ' active' : ''}`}
          aria-label="Фокус для сканера"
          title="USB-сканер держит фокус для ввода штрихкодов"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            input.current?.focus({ preventScroll: true });
          }}
          onClick={() => {
            input.current?.focus({ preventScroll: true });
            setIsFocused(true);
          }}
        >
          <svg
            className="pos-icon scan-field-btn-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />
          </svg>
          <span>Сканер</span>
          <span
            className={`pos-focus-dot${isFocused ? ' on' : ''}`}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="scan-field-btn pos-tool"
          aria-label="Сканировать камерой"
          disabled={disabled}
          onClick={() => setCamera(true)}
        >
          <svg
            className="pos-icon scan-field-btn-icon"
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
          <span>Камера</span>
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
