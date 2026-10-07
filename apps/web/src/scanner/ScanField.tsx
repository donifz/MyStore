import { useRef, useState } from 'react';
export default function ScanField({
  onScan,
  disabled = false,
}: {
  onScan: (code: string) => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState(''),
    input = useRef<HTMLInputElement>(null);
  return (
    <div className="scan-field">
      <label>
        Сканировать штрихкод
        <input
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
              if (value) onScan(value);
              setCode('');
            }
          }}
          placeholder="Сканер или код + Enter"
        />
      </label>
      <p className="muted">
        USB-сканер вводит код как клавиатура. Один скан — одна единица.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.focus()}
      >
        Фокус для сканера
      </button>
    </div>
  );
}
