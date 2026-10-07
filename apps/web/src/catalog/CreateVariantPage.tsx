import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { parseSom } from '../api/money';
import { Variant } from '../api/types';
import { useSession } from '../auth/SessionProvider';
export default function CreateVariantPage() {
  const { shopId } = useParams(),
    session = useSession(),
    [name, setName] = useState(''),
    [barcode, setBarcode] = useState(''),
    [price, setPrice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<Variant | null>(null);
  if (session.user?.shops.find((s) => s.id === shopId)?.role === 'cashier')
    return <p role="alert">Недостаточно прав для создания товара.</p>;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setSaved(
        await api<Variant>(`/shops/${shopId}/variants`, {
          method: 'POST',
          body: {
            name: name.trim(),
            ...(barcode ? { barcode } : {}),
            salePriceMinor: parseSom(price),
          },
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to={'/seller/' + shopId + '/products'}>
        ← Товары
      </Link>
      <h1>Новый товар</h1>
      <section className="panel form-panel">
        {saved ? (
          <>
            <p role="status" className="success">
              Товар создан. Остаток не изменён.
            </p>
            <p>
              {saved.name} · {saved.barcode}
            </p>
            <Link
              to={'/seller/' + shopId + '/receiving'}
              className="primary button"
            >
              Перейти к приёмке
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              Название
              <input
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Штрихкод
              <input
                maxLength={64}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Пусто — создадим код автоматически"
              />
            </label>
            <label>
              Цена продажи, сом
              <input
                required
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <p className="muted">
              Создание карточки не меняет остаток. Товар поступает через
              приёмку.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? 'Сохранение…' : 'Сохранить товар'}
            </button>
          </form>
        )}
      </section>
    </>
  );
}
