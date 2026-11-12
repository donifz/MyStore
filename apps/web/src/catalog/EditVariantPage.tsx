import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import { Variant, ShopCustomAttribute, hasShopPermission } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import { AdminStatus } from '../platform/AdminKit';
import { useResource } from '../storefront/use-resource';
import BarcodeLabel from './BarcodeLabel';
import EditProductPhotos from './EditProductPhotos';
import type { CategoryNode } from './PhotoAssistant';
import ProductStockAdjuster from './ProductStockAdjuster';
import ProductThumb from './ProductThumb';

type DetailTab = 'main' | 'photos' | 'variants' | 'stock' | 'storefront';

function previewMinor(value: string): number | null {
  try {
    return parseSom(value);
  } catch {
    return null;
  }
}

function formatPercent(value: number) {
  return (
    (value > 0 ? '+' : '') +
    new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 1,
    }).format(value) +
    '%'
  );
}

function publicationMeta(status?: Variant['publicationStatus']) {
  if (status === 'approved') {
    return { label: 'Одобрен на витрине', tone: 'green' as const };
  }
  if (status === 'pending') {
    return { label: 'Ожидает проверки', tone: 'amber' as const };
  }
  return { label: 'Не опубликован', tone: 'neutral' as const };
}

export default function EditVariantPage() {
  const { shopId, id } = useParams(),
    s = useSession();
  const membership = s.user?.shops.find((x) => x.id === shopId);
  const allowed = membership?.role !== 'cashier';
  const canViewCost =
    allowed &&
    (membership?.role !== 'cashier' ||
      hasShopPermission(membership, 'reports'));
  const r = useResource<Variant>(
      allowed ? `/shops/${shopId}/variants/${id}` : null,
    ),
    [name, setName] = useState(''),
    [price, setPrice] = useState(''),
    [description, setDescription] = useState(''),
    [category, setCategory] = useState(''),
    [subcategory, setSubcategory] = useState(''),
    [categories, setCategories] = useState<CategoryNode[]>([]),
    [customAttrs, setCustomAttrs] = useState<ShopCustomAttribute[]>([]),
    [customValues, setCustomValues] = useState<Record<string, string>>({}),
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
      useState<Variant['publicationStatus']>(),
    [activeTab, setActiveTab] = useState<DetailTab>('main'),
    [photoOverride, setPhotoOverride] = useState<Variant | null>(null),
    [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false),
    [stockAdjustDialogOpen, setStockAdjustDialogOpen] = useState(false),
    [stockOverride, setStockOverride] = useState<{
      physical: number;
      available: number;
      reserved: number;
    } | null>(null),
    [syncedData, setSyncedData] = useState<Variant | null>(null);

  useEffect(() => {
    setPhotoOverride(null);
    setStockOverride(null);
    setActiveTab('main');
    setBarcodeDialogOpen(false);
    setStockAdjustDialogOpen(false);
  }, [id]);

  if (r.data && r.data !== syncedData) {
    setSyncedData(r.data);
    setStockOverride(null);
    setName(r.data.name);
    const minor = BigInt(r.data.salePriceMinor);
    setPrice(`${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`);
    setDescription(r.data.description ?? '');
    setCategory(r.data.category ?? '');
    setSubcategory(r.data.subcategory ?? '');
    setPublished(r.data.published ?? true);
    setArchived(Boolean(r.data.archived));
    setPublicationStatus(r.data.publicationStatus);
    if (r.data.attributes && typeof r.data.attributes === 'object') {
      const strVals: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.data.attributes)) {
        strVals[k] = String(v ?? '');
      }
      setCustomValues(strVals);
    } else {
      setCustomValues({});
    }
    setSaved(false);
  }

  useEffect(() => {
    if (allowed && shopId) {
      void api<CategoryNode[]>(`/shops/${shopId}/categories`)
        .then((value) => setCategories(Array.isArray(value) ? value : []))
        .catch((e) => setError(errorText(e)));
      void api<ShopCustomAttribute[]>(`/shops/${shopId}/custom-attributes`)
        .then((value) => setCustomAttrs(Array.isArray(value) ? value : []))
        .catch(() => {});
    }
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

  async function saveChanges() {
    if (!name.trim()) {
      setError('Укажите название товара.');
      setActiveTab('main');
      return;
    }
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const cleanAttrs: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(customValues)) {
        if (v !== '' && v !== undefined && v !== null) {
          const def = customAttrs.find((a) => a.key === k);
          cleanAttrs[k] = def?.type === 'number' ? Number(v) : v;
        }
      }
      const updated = await api<Variant>(`/shops/${shopId}/variants/${id}`, {
        method: 'PUT',
        body: {
          name: name.trim(),
          salePriceMinor: parseSom(price),
          description,
          category,
          subcategory,
          published,
          attributes: cleanAttrs,
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    await saveChanges();
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
    } catch (e: unknown) {
      if ((e as { status?: number })?.status === 409) {
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

  const activeVariant =
    r.data && photoOverride
      ? {
          ...r.data,
          photoUrl: photoOverride.photoUrl,
          photoUrls: photoOverride.photoUrls,
          publicationStatus:
            photoOverride.publicationStatus ?? publicationStatus,
        }
      : r.data;
  const rootId = r.data ? r.data.parentId || r.data.id : id;
  const currentPub = publicationMeta(
    photoOverride?.publicationStatus ?? publicationStatus,
  );
  const heroPhoto = activeVariant?.photoUrl || activeVariant?.photoUrls?.[0];
  const photoCount =
    activeVariant?.photoUrls?.length ?? (activeVariant?.photoUrl ? 1 : 0);

  const liveSaleMinor = r.data
    ? (previewMinor(price) ?? r.data.salePriceMinor)
    : null;
  const purchaseMinor =
    canViewCost && r.data?.lastPurchaseMinor !== undefined
      ? r.data.lastPurchaseMinor
      : undefined;
  const profitMinor =
    liveSaleMinor !== null && purchaseMinor !== undefined
      ? liveSaleMinor - purchaseMinor
      : undefined;
  const markupPct =
    profitMinor !== undefined && purchaseMinor && purchaseMinor > 0
      ? (profitMinor / purchaseMinor) * 100
      : undefined;
  const marginPct =
    profitMinor !== undefined && liveSaleMinor && liveSaleMinor > 0
      ? (profitMinor / liveSaleMinor) * 100
      : undefined;

  const availableCount = stockOverride
    ? stockOverride.available
    : (r.data?.available ?? 0);
  const physicalCount = stockOverride
    ? stockOverride.physical
    : (r.data?.physical ?? 0);
  const reservedCount = stockOverride
    ? stockOverride.reserved
    : (r.data?.reserved ?? 0);
  const categoryTrail = [category, subcategory].filter(Boolean).join(' → ');

  return (
    <div className="product-detail-page">
      <div className="product-detail-topbar">
        <Link className="back-link" to={`/seller/${shopId}/products`}>
          ← Назад к товарам
        </Link>
        {r.data && (
          <div className="product-detail-actions">
            {allowed && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setActiveTab('stock');
                  setStockAdjustDialogOpen(true);
                }}
              >
                Изменить остаток
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={() => setBarcodeDialogOpen(true)}
            >
              Этикетка
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={archiveBusy}
              onClick={handleArchiveToggle}
            >
              {archiveBusy ? 'Обработка…' : archived ? 'Из архива' : 'В архив'}
            </button>
            <button
              type="button"
              className="primary product-detail-save-btn"
              disabled={busy || archiveBusy}
              onClick={() => void saveChanges()}
            >
              {busy ? 'Сохранение…' : 'Сохранить изменения'}
            </button>
          </div>
        )}
      </div>

      {r.error && (
        <p role="alert" className="error">
          {errorText(new Error(r.error))}
        </p>
      )}
      {!r.data && !r.error && <p role="status">Загрузка…</p>}

      {r.data && activeVariant && (
        <>
          <section
            className="admin-kit-card product-detail-hero"
            aria-label="Сводка товара"
          >
            <div className="product-detail-hero__main">
              <button
                type="button"
                className="product-detail-thumb-btn"
                aria-label="Перейти к фотографиям товара"
                onClick={() => setActiveTab('photos')}
              >
                <ProductThumb
                  photoUrl={heroPhoto}
                  name={name || r.data.name}
                  className="product-detail-thumb"
                  iconSize={26}
                />
                <span className="product-detail-thumb-badge" aria-hidden="true">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </span>
              </button>

              <div className="product-detail-hero__info">
                <div className="product-detail-title-row">
                  <h1>{name || 'Редактировать товар'}</h1>
                  <AdminStatus tone={archived ? 'neutral' : 'green'}>
                    {archived ? 'В архиве' : 'Активен'}
                  </AdminStatus>
                  <AdminStatus tone={currentPub.tone}>
                    {currentPub.label}
                  </AdminStatus>
                </div>
                <p className="product-detail-meta">
                  {categoryTrail && <span>{categoryTrail}</span>}
                  <span>#{r.data.shortBarcode || r.data.barcode}</span>
                  {r.data.sku && <span>Арт. {r.data.sku}</span>}
                  <span>Штрихкод {r.data.barcode}</span>
                </p>
              </div>
            </div>

            <div className="product-detail-kpis">
              <div className="product-detail-kpi">
                <span>Цена продажи</span>
                <strong>
                  {liveSaleMinor !== null
                    ? formatSom(liveSaleMinor)
                    : formatSom(r.data.salePriceMinor)}
                </strong>
              </div>
              {canViewCost && (
                <div className="product-detail-kpi">
                  <span>Закупочная</span>
                  <strong>
                    {purchaseMinor !== undefined
                      ? formatSom(purchaseMinor)
                      : '—'}
                  </strong>
                </div>
              )}
              {canViewCost && (
                <div className="product-detail-kpi">
                  <span>Наценка</span>
                  <strong
                    className={
                      markupPct !== undefined && markupPct > 0
                        ? 'product-detail-kpi__accent'
                        : undefined
                    }
                  >
                    {markupPct !== undefined ? formatPercent(markupPct) : '—'}
                  </strong>
                </div>
              )}
              <div className="product-detail-kpi product-detail-kpi--stock">
                <span>Доступно</span>
                <strong>
                  {availableCount} шт.
                  <small className="product-detail-kpi__note">
                    резерв {reservedCount}
                  </small>
                </strong>
                {allowed && (
                  <button
                    type="button"
                    className="product-detail-kpi__adjust-btn"
                    onClick={() => {
                      setActiveTab('stock');
                      setStockAdjustDialogOpen(true);
                    }}
                  >
                    Изменить остаток
                  </button>
                )}
              </div>
            </div>
          </section>

          <nav
            className="product-detail-tabs"
            role="tablist"
            aria-label="Разделы карточки товара"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'main'}
              className={`product-detail-tab${activeTab === 'main' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              Основное и цены
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'photos'}
              className={`product-detail-tab${activeTab === 'photos' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('photos')}
            >
              Фотографии ({photoCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'variants'}
              className={`product-detail-tab${activeTab === 'variants' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('variants')}
            >
              Разновидности ({groupVariants.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'stock'}
              className={`product-detail-tab${activeTab === 'stock' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('stock')}
            >
              Склад и штрихкод
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'storefront'}
              className={`product-detail-tab${activeTab === 'storefront' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('storefront')}
            >
              Витрина и архив
            </button>
          </nav>

          {saved && (
            <p role="status" className="success product-detail-banner">
              Товар обновлён. Цена: {formatSom(savedPrice)}
            </p>
          )}
          {error && (
            <p role="alert" className="error product-detail-banner">
              {error}
            </p>
          )}
          {archiveError && (
            <p role="alert" className="error product-detail-banner">
              {archiveError}
            </p>
          )}

          {activeTab === 'main' && (
            <section
              className="admin-kit-card product-detail-sheet"
              role="tabpanel"
              aria-label="Основное и цены"
            >
              <form
                id="edit-variant-form"
                onSubmit={submit}
                onChange={() => setSaved(false)}
              >
                <fieldset
                  disabled={busy || archiveBusy}
                  className="product-detail-fieldset"
                >
                  <div className="product-detail-section">
                    <h2 className="product-detail-section__title">
                      Основная информация
                    </h2>
                    <div className="product-detail-form-grid">
                      <div className="product-detail-col">
                        <label>
                          Название товара
                          <input
                            required
                            maxLength={200}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <label>
                          Описание для покупателей
                          <textarea
                            rows={4}
                            maxLength={2000}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="product-detail-col">
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
                        <label className="checkbox checkbox-label product-detail-switch">
                          <input
                            type="checkbox"
                            checked={published}
                            onChange={(e) => setPublished(e.target.checked)}
                          />
                          Показывать на витрине
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="product-detail-section">
                    <h2 className="product-detail-section__title">
                      Ценообразование
                    </h2>
                    <div className="product-detail-pricing-grid">
                      <label>
                        Цена продажи, сом
                        <input
                          required
                          inputMode="decimal"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                        />
                      </label>
                      {canViewCost && (
                        <div className="product-detail-readonly-box">
                          <span className="product-detail-readonly-box__label">
                            Закупочная цена
                          </span>
                          <strong>
                            {purchaseMinor !== undefined
                              ? formatSom(purchaseMinor)
                              : 'Не указана'}
                          </strong>
                          <small className="muted">По последней приёмке</small>
                        </div>
                      )}
                      {canViewCost && (
                        <div
                          className={`product-detail-readonly-box${profitMinor !== undefined && profitMinor > 0 ? ' is-positive' : ''}`}
                        >
                          <span className="product-detail-readonly-box__label">
                            Чистая прибыль с 1 шт.
                          </span>
                          <strong>
                            {profitMinor !== undefined ? (
                              <>
                                {profitMinor > 0 ? '+' : ''}
                                {formatSom(profitMinor)}
                                {marginPct !== undefined && (
                                  <span className="product-detail-margin-note">
                                    {' '}
                                    · маржа {formatPercent(marginPct)}
                                  </span>
                                )}
                              </>
                            ) : (
                              '—'
                            )}
                          </strong>
                          <small className="muted">
                            {profitMinor !== undefined
                              ? 'Разница между ценой продажи и закупкой'
                              : 'Появится после первой приёмки'}
                          </small>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="product-detail-section">
                    <h2 className="product-detail-section__title">
                      Характеристики товара
                    </h2>
                    <div className="product-detail-specs-strip">
                      <div>
                        <span>Штрихкод</span>
                        <strong className="code">{r.data.barcode}</strong>
                      </div>
                      {r.data.sku && (
                        <div>
                          <span>Артикул</span>
                          <strong className="code">{r.data.sku}</strong>
                        </div>
                      )}
                      <div>
                        <span>Размер</span>
                        <strong>{r.data.size || '—'}</strong>
                      </div>
                      <div>
                        <span>Цвет</span>
                        <strong>{r.data.color || '—'}</strong>
                      </div>
                    </div>

                    {customAttrs.length > 0 && (
                      <div className="product-detail-attrs-grid">
                        {customAttrs.map((attr) => (
                          <label key={attr.id}>
                            {attr.name}
                            {attr.type === 'select' ? (
                              <select
                                value={customValues[attr.key] || ''}
                                onChange={(e) =>
                                  setCustomValues((prev) => ({
                                    ...prev,
                                    [attr.key]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Не выбрано</option>
                                {attr.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : attr.type === 'number' ? (
                              <input
                                type="number"
                                value={customValues[attr.key] || ''}
                                onChange={(e) =>
                                  setCustomValues((prev) => ({
                                    ...prev,
                                    [attr.key]: e.target.value,
                                  }))
                                }
                                placeholder="Число"
                              />
                            ) : (
                              <input
                                type="text"
                                maxLength={100}
                                value={customValues[attr.key] || ''}
                                onChange={(e) =>
                                  setCustomValues((prev) => ({
                                    ...prev,
                                    [attr.key]: e.target.value,
                                  }))
                                }
                                placeholder="Значение"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </fieldset>
              </form>
            </section>
          )}

          {activeTab === 'photos' && shopId && (
            <div role="tabpanel" aria-label="Фотографии">
              <EditProductPhotos
                shopId={shopId}
                variant={activeVariant}
                onSaved={(updated) => setPhotoOverride(updated)}
              />
            </div>
          )}

          {activeTab === 'variants' && (
            <section
              className="admin-kit-card"
              role="tabpanel"
              aria-label="Разновидности"
            >
              <div className="admin-kit-card-head">
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
              {!groupLoading && groupVariants.length === 0 && (
                <p className="admin-kit-empty">
                  У товара пока нет связанных размеров или цветов.
                </p>
              )}
              {!groupLoading && groupVariants.length > 0 && (
                <div className="admin-kit-scroll">
                  <table className="admin-kit-table">
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
                            <strong>
                              {gv.name}
                              {gv.id === id && (
                                <span className="muted"> (текущий)</span>
                              )}
                            </strong>
                          </td>
                          <td>{gv.size || '—'}</td>
                          <td>{gv.color || '—'}</td>
                          <td>
                            <small className="code">{gv.barcode}</small>
                          </td>
                          <td>{formatSom(gv.salePriceMinor)}</td>
                          <td>
                            <span
                              className={
                                'stock ' + (gv.available ? '' : 'empty')
                              }
                            >
                              {gv.available ?? 0} шт.
                            </span>
                          </td>
                          <td>
                            <AdminStatus
                              tone={gv.archived ? 'neutral' : 'green'}
                            >
                              {gv.archived ? 'В архиве' : 'Активен'}
                            </AdminStatus>
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
          )}

          {activeTab === 'stock' && (
            <div
              className="product-detail-stock-grid"
              role="tabpanel"
              aria-label="Склад и штрихкод"
            >
              <section className="admin-kit-card">
                <div className="admin-kit-card-head">
                  <div>
                    <h2>Остатки на складе</h2>
                    <p className="muted">
                      Актуальное количество по данным складского учёта
                    </p>
                  </div>
                  <Link
                    to={`/seller/${shopId}/receiving`}
                    className="button secondary"
                  >
                    Оприходовать товар
                  </Link>
                </div>
                <div className="product-detail-stock-tiles">
                  <div className="product-detail-stock-tile is-accent">
                    <span>Доступно к продаже</span>
                    <strong>{availableCount} шт.</strong>
                  </div>
                  <div className="product-detail-stock-tile">
                    <span>На складе (физ.)</span>
                    <strong>{physicalCount} шт.</strong>
                  </div>
                  <div className="product-detail-stock-tile">
                    <span>В резерве заказов</span>
                    <strong>{reservedCount} шт.</strong>
                  </div>
                </div>

                {allowed && shopId && id && (
                  <div className="product-detail-stock-adjust-wrap">
                    <ProductStockAdjuster
                      shopId={shopId}
                      variantId={id}
                      variantName={name || r.data?.name || ''}
                      physicalCount={physicalCount}
                      reservedCount={reservedCount}
                      availableCount={availableCount}
                      defaultUnitCostMinor={r.data?.lastPurchaseMinor}
                      canViewCost={canViewCost}
                      onStockUpdated={(newStock) => {
                        setStockOverride(newStock);
                      }}
                    />
                  </div>
                )}
              </section>

              <section className="admin-kit-card">
                <div className="admin-kit-card-head">
                  <div>
                    <h2>Штрихкод и печать этикетки</h2>
                    <p className="muted">
                      Используйте короткий код или EAN-13 для печати ценников
                    </p>
                  </div>
                </div>
                <BarcodeLabel product={r.data} />
              </section>
            </div>
          )}

          {activeTab === 'storefront' && (
            <div
              className="product-detail-storefront-grid"
              role="tabpanel"
              aria-label="Витрина и архив"
            >
              <section className="admin-kit-card">
                <div className="admin-kit-card-head">
                  <div>
                    <h2>Публикация на витрине</h2>
                    <p className="muted">
                      Новая карточка и изменения названия, описания и категории
                      проходят проверку. Цена и наличие обновляются сразу после
                      сохранения.
                    </p>
                  </div>
                  <AdminStatus tone={currentPub.tone}>
                    {currentPub.label}
                  </AdminStatus>
                </div>
                <label className="checkbox checkbox-label product-detail-switch">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => {
                      setPublished(e.target.checked);
                      setSaved(false);
                    }}
                  />
                  Показывать на витрине
                </label>
                <p style={{ marginTop: '0.75rem' }}>
                  Публичная карточка:{' '}
                  {(photoOverride?.publicationStatus ?? publicationStatus) ===
                  'pending'
                    ? 'ожидает проверки'
                    : (photoOverride?.publicationStatus ??
                          publicationStatus) === 'approved'
                      ? 'одобрена'
                      : 'ещё не опубликована'}
                  .
                </p>
                {r.data.rejectionReason && (
                  <p className="error" style={{ marginTop: '0.5rem' }}>
                    Последний отказ: {r.data.rejectionReason}
                  </p>
                )}
              </section>

              <section className="admin-kit-card">
                <div className="admin-kit-card-head">
                  <div>
                    <h2>Управление архивом</h2>
                    <p className="muted">
                      {archived
                        ? 'Товар находится в архиве: он скрыт из активного каталога, не продаётся на кассе POS и не отображается на витрине.'
                        : 'Архивированный товар скрывается из каталога и витрины, его нельзя продать или принять на склад. Если у товара есть активные резервы покупателей, архивация будет заблокирована.'}
                    </p>
                  </div>
                </div>
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
              </section>
            </div>
          )}
        </>
      )}

      {barcodeDialogOpen && r.data && (
        <div
          className="barcode-dialog-backdrop"
          role="presentation"
          onClick={() => setBarcodeDialogOpen(false)}
        >
          <section
            className="barcode-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Этикетка: ${r.data.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="barcode-dialog-heading">
              <h2>Этикетка товара</h2>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setBarcodeDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <BarcodeLabel product={r.data} />
          </section>
        </div>
      )}

      {stockAdjustDialogOpen && r.data && shopId && id && (
        <div
          className="barcode-dialog-backdrop"
          role="presentation"
          onClick={() => setStockAdjustDialogOpen(false)}
        >
          <section
            className="product-stock-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Корректировка остатка: ${name || r.data.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <ProductStockAdjuster
              shopId={shopId}
              variantId={id}
              variantName={name || r.data.name}
              physicalCount={physicalCount}
              reservedCount={reservedCount}
              availableCount={availableCount}
              defaultUnitCostMinor={r.data.lastPurchaseMinor}
              canViewCost={canViewCost}
              onStockUpdated={(newStock) => {
                setStockOverride(newStock);
              }}
              onClose={() => setStockAdjustDialogOpen(false)}
            />
          </section>
        </div>
      )}
    </div>
  );
}
