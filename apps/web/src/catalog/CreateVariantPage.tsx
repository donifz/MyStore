import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { parseSom } from '../api/money';
import { Variant } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import type { CategoryNode } from './PhotoAssistant';
export default function CreateVariantPage() {
  const { shopId } = useParams(),
    session = useSession(),
    [name, setName] = useState(''),
    [barcode, setBarcode] = useState(''),
    [price, setPrice] = useState(''),
    [category, setCategory] = useState(''),
    [subcategory, setSubcategory] = useState(''),
    [categories, setCategories] = useState<CategoryNode[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<Variant | null>(null);
  useEffect(() => {
    if (shopId)
      void api<CategoryNode[]>(`/shops/${shopId}/categories`)
        .then((value) => setCategories(Array.isArray(value) ? value : []))
        .catch((e) => setError(errorText(e)));
  }, [shopId]);
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
            category,
            subcategory,
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
            <label>
              Категория
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory('');
                }}
              >
                <option value="">Без категории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Подкатегория
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={!category}
              >
                <option value="">Без подкатегории</option>
                {categories
                  .find((c) => c.name === category)
                  ?.children.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
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
