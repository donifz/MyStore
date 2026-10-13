import { useRef, useState, type FormEvent } from 'react';
import { api, ApiError, errorText } from '../api/client';
import { parseSom, formatSom } from '../api/money';
import type { Variant } from '../api/types';
export default function ReceivingProductForm({
  shopId,
  barcode,
  disabled,
  onCancel,
  onCreated,
}: {
  shopId: string;
  barcode: string;
  disabled: boolean;
  onCancel: () => void;
  onCreated: (variant: Variant) => Promise<boolean>;
}) {
  const [name, setName] = useState(''),
    [price, setPrice] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState<Variant | null>(null),
    [foundExisting, setFoundExisting] = useState(false);
  const submitting = useRef(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      let variant = saved;
      if (!variant) {
        if (!name.trim()) throw new Error('Укажите название товара.');
        try {
          variant = await api<Variant>(`/shops/${shopId}/variants`, {
            method: 'POST',
            body: {
              name: name.trim(),
              barcode,
              salePriceMinor: parseSom(price),
            },
          });
          setSaved(variant);
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            const existing = await api<Variant>(
              `/shops/${shopId}/variants/by-barcode?code=${encodeURIComponent(barcode)}`,
            );
            setSaved(existing);
            setFoundExisting(true);
            setError(
              'Товар с этим штрихкодом уже существует. Проверьте карточку перед добавлением.',
            );
            return;
          }
          throw e;
        }
      }
      if (!(await onCreated(variant)))
        setError(
          'Карточка сохранена, но черновик не изменён. Обновите черновик и добавьте товар.',
        );
    } catch (e) {
      setError(errorText(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      className="receiving-product-form"
      aria-label="Новый товар в приёмке"
      onSubmit={(e) => void submit(e)}
    >
      <h2>Новый товар в приёмке</h2>
      <p className="muted">
        Карточка добавится в текущий документ. Остаток изменится после
        проведения приёмки.
      </p>
      <label>
        Штрихкод
        <input value={barcode} readOnly />
      </label>
      {saved ? (
        <p>
          {saved.name} · {formatSom(saved.salePriceMinor)}.{' '}
          {foundExisting
            ? 'Найдена существующая карточка.'
            : 'Карточка сохранена.'}
        </p>
      ) : (
        <>
          <label>
            Название
            <input
              required
              autoFocus
              maxLength={200}
              value={name}
              disabled={busy || disabled}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Цена продажи, сом
            <input
              required
              inputMode="decimal"
              value={price}
              disabled={busy || disabled}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="receiving-product-actions">
        <button type="submit" className="primary" disabled={busy || disabled}>
          {busy
            ? 'Сохранение…'
            : saved
              ? 'Добавить в приёмку'
              : 'Создать и добавить в приёмку'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
