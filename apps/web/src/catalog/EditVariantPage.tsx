import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import { Variant } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import { useResource } from '../storefront/use-resource';
import type { CategoryNode } from './PhotoAssistant';
import EditProductPhotos from './EditProductPhotos';
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
    [archived, setArchived] = useState(false),
    [archiveBusy, setArchiveBusy] = useState(false),
    [archiveError, setArchiveError] = useState(''),
    [groupVariants, setGroupVariants] = useState<Variant[]>([]),
    [groupLoading, setGroupLoading] = useState(false),
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
      setArchived(Boolean(r.data.archived));
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
  useEffect(() => {
    if (allowed && shopId && id) {
      setGroupLoading(true);
      api<Variant[]>(`/shops/${shopId}/variants/${id}/variants`)
        .then(setGroupVariants)
        .catch(() => {})
        .finally(() => setGroupLoading(false));
    }
  }, [allowed, shopId, id]);
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
  async function handleArchiveToggle() {
    if (!shopId || !id) return;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      const action = archived ? 'unarchive' : 'archive';
      const updated = await api<Variant>(
        `/shops/${shopId}/variants/${id}/${action}`,
        { method: 'PUT' },
      );
      setArchived(Boolean(updated.archived));
      const group = await api<Variant[]>(
        `/shops/${shopId}/variants/${id}/variants`,
      );
      setGroupVariants(group);
    } catch (e: any) {
      if (e?.status === 409) {
        setArchiveError(
          'Нельзя архивировать товар с активными резервами в онлайн-заказах.',
        );
      } else {
        setArchiveError(errorText(e));
      }
    } finally {
      setArchiveBusy(false);
    }
  }
  if (!allowed)
    return <p role="alert">Недостаточно прав для изменения товара.</p>;
  const rootId = r.data ? r.data.parentId || r.data.id : id;
  return (
    <>
      <Link className="back-link" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Карточка товара</p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <h1>{name || 'Редактировать товар'}</h1>
            {r.data && (
              <span
                className={`status-pill ${
                  archived ? 'status-archived' : 'status-active'
                }`}
              >
                {archived ? 'В архиве' : 'Активен'}
              </span>
            )}
          </div>
        </div>
      </div>
      {r.error && (
        <p role="alert" className="error">
          {errorText(new Error(r.error))}
        </p>
      )}
      {!r.data && !r.error && <p role="status">Загрузка…</p>}
      {r.data && (
        <>
          <section className="panel form-panel">
            <form onSubmit={submit} onChange={() => setSaved(false)}>
              <fieldset disabled={busy || archiveBusy}>
                <label>
                  Название
                  <input
                    required
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <p className="code">Штрихкод: {r.data.barcode}</p>
                  {r.data.sku && <p className="code">Артикул: {r.data.sku}</p>}
                  {r.data.size && (
                    <p className="muted">Размер: {r.data.size}</p>
                  )}
                  {r.data.color && (
                    <p className="muted">Цвет: {r.data.color}</p>
                  )}
                </div>
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
                <div
                  style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
                >
                  <button className="primary">
                    {busy ? 'Сохранение…' : 'Сохранить изменения'}
                  </button>
                </div>
              </fieldset>
            </form>
          </section>

          {/* Group variants section */}
          <section className="panel" style={{ marginTop: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <h2>Разновидности (размеры / цвета)</h2>
                <p className="muted">
                  Связанные товары с независимыми ценами, штрихкодами и
                  остатками
                </p>
              </div>
              <Link
                to={`/seller/${shopId}/products/new?parentId=${rootId}`}
                className="button secondary"
              >
                + Добавить размер / цвет
              </Link>
            </div>
            {groupLoading && <p>Загрузка разновидностей…</p>}
            {!groupLoading && groupVariants.length > 0 && (
              <div className="table-wrap" style={{ marginTop: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Размер</th>
                      <th>Цвет</th>
                      <th>Штрихкод</th>
                      <th>Цена</th>
                      <th>Остаток</th>
                      <th>Статус</th>
                      <th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupVariants.map((gv) => (
                      <tr
                        key={gv.id}
                        style={
                          gv.id === id
                            ? { backgroundColor: 'rgba(0, 118, 89, 0.05)' }
                            : undefined
                        }
                      >
                        <td>
                          <strong>{gv.name}</strong>
                          {gv.id === id && (
                            <span className="muted"> (текущий)</span>
                          )}
                        </td>
                        <td>{gv.size || '—'}</td>
                        <td>{gv.color || '—'}</td>
                        <td>
                          <small className="code">{gv.barcode}</small>
                        </td>
                        <td>{formatSom(gv.salePriceMinor)}</td>
                        <td>
                          <span
                            className={'stock ' + (gv.available ? '' : 'empty')}
                          >
                            {gv.available} шт.
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${gv.archived ? 'status-archived' : 'status-active'}`}
                          >
                            {gv.archived ? 'В архиве' : 'Активен'}
                          </span>
                        </td>
                        <td>
                          {gv.id !== id ? (
                            <Link
                              to={`/seller/${shopId}/products/${gv.id}/edit`}
                            >
                              Открыть
                            </Link>
                          ) : (
                            <span className="muted">Открыт</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Archive / unarchive management section */}
          <section className="panel" style={{ marginTop: '1.5rem' }}>
            <h2>Управление архивом</h2>
            <p className="muted">
              {archived
                ? 'Товар находится в архиве: он скрыт из активного каталога, не продаётся на кассе POS и не отображается на витрине.'
                : 'Архивированный товар скрывается из каталога и витрины, его нельзя продать или принять на склад. Если у товара есть активные резервы покупателей, архивация будет заблокирована.'}
            </p>
            {archiveError && (
              <p role="alert" className="error" style={{ marginTop: '0.5rem' }}>
                {archiveError}
              </p>
            )}
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className={`button ${archived ? 'primary' : 'secondary'}`}
                disabled={archiveBusy}
                onClick={handleArchiveToggle}
              >
                {archiveBusy
                  ? 'Обработка…'
                  : archived
                    ? 'Вернуть товар из архива'
                    : 'Перенести товар в архив'}
              </button>
            </div>
          </section>
        </>
      )}
      {r.data && shopId && (
        <EditProductPhotos shopId={shopId} variant={r.data} />
      )}
    </>
  );
}
