import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import { Variant } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import { useResource } from '../storefront/use-resource';
export default function EditVariantPage() {
  const { shopId, id } = useParams(),
    s = useSession();
  const allowed =
    s.user?.shops.find((x) => x.id === shopId)?.role !== 'cashier';
  const r = useResource<Variant>(
      allowed ? `/shops/${shopId}/variants/${id}` : null,
    ),
    [name, setName] = useState(''),
    [price, setPrice] = useState(''),
    [description, setDescription] = useState(''),
    [category, setCategory] = useState(''),
    [published, setPublished] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [savedPrice, setSavedPrice] = useState(0);
  useEffect(() => {
    if (r.data) {
      setName(r.data.name);
      setPrice(String(r.data.salePriceMinor / 100));
      setDescription(r.data.description ?? '');
      setCategory(r.data.category ?? '');
      setPublished(r.data.published ?? true);
      setSaved(false);
    }
  }, [r.data]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api<Variant>(`/shops/${shopId}/variants/${id}`, {
        method: 'PUT',
        body: {
          name: name.trim(),
          salePriceMinor: parseSom(price),
          description,
          category,
          published,
        },
      });
      setSavedPrice(updated.salePriceMinor);
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return <p role="alert">Недостаточно прав для изменения товара.</p>;
  return (
    <>
      <Link className="back-link" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <h1>Редактировать товар</h1>
      {r.error && (
        <p role="alert" className="error">
          {errorText(new Error(r.error))}
        </p>
      )}
      {!r.data && !r.error && <p role="status">Загрузка…</p>}
      {r.data && (
        <section className="panel form-panel">
          <form onSubmit={submit} onChange={() => setSaved(false)}>
            <fieldset disabled={busy}>
              <label>
                Название
                <input
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <p className="code">Штрихкод: {r.data.barcode}</p>
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
                <input
                  maxLength={80}
                  placeholder="Например, Посуда"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label>
                Описание
                <textarea
                  rows={5}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Показывать на витрине
              </label>
              <p className="muted">
                Карточка будет доступна покупателям, когда магазин опубликован.
                Изменение цены не меняет проведённые продажи.
              </p>
              {saved && (
                <p role="status" className="success">
                  Товар обновлён. Цена: {formatSom(savedPrice)}
                </p>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary">
                {busy ? 'Сохранение…' : 'Сохранить изменения'}
              </button>
            </fieldset>
          </form>
        </section>
      )}
    </>
  );
}
