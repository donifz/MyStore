import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import { Variant } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import { useResource } from '../storefront/use-resource';
import type { CategoryNode } from './PhotoAssistant';
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
    [subcategory, setSubcategory] = useState(''),
    [categories, setCategories] = useState<CategoryNode[]>([]),
    [published, setPublished] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [savedPrice, setSavedPrice] = useState(0),
    [publicationStatus, setPublicationStatus] =
      useState<Variant['publicationStatus']>();
  useEffect(() => {
    if (r.data) {
      setName(r.data.name);
      const minor = BigInt(r.data.salePriceMinor);
      setPrice(`${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`);
      setDescription(r.data.description ?? '');
      setCategory(r.data.category ?? '');
      setSubcategory(r.data.subcategory ?? '');
      setPublished(r.data.published ?? true);
      setPublicationStatus(r.data.publicationStatus);
      setSaved(false);
    }
  }, [r.data]);
  useEffect(() => {
    if (allowed && shopId)
      void api<CategoryNode[]>(`/shops/${shopId}/categories`)
        .then((value) => setCategories(Array.isArray(value) ? value : []))
        .catch((e) => setError(errorText(e)));
  }, [allowed, shopId]);
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
          subcategory,
          published,
        },
      });
      setSavedPrice(updated.salePriceMinor);
      setPublicationStatus(updated.publicationStatus);
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
                Новая карточка и изменения названия, описания и категории
                проходят проверку. Цена и наличие обновляются сразу после
                сохранения.
              </p>
              <p>
                Публичная карточка:{' '}
                {publicationStatus === 'pending'
                  ? 'ожидает проверки'
                  : publicationStatus === 'approved'
                    ? 'одобрена'
                    : 'ещё не опубликована'}
                .
              </p>
              {r.data.rejectionReason && (
                <p>Последний отказ: {r.data.rejectionReason}</p>
              )}
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
