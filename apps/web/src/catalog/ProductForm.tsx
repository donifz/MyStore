import { useCallback, useId, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, errorText } from '../api/client';
import { parseSom, formatSom } from '../api/money';
import type { Variant } from '../api/types';
import PhotoAssistant, { type CategoryNode } from './PhotoAssistant';
import { photoFrom } from './product-photo';
export default function ProductForm({
  shopId,
  parentId,
  initialBarcode = '',
  barcodeReadOnly = false,
  disabled = false,
  title = 'Карточка товара',
  submitLabel = 'Сохранить товар',
  formLabel = 'Добавить товар',
  savedLabel = 'Продолжить',
  onCancel,
  onSaved,
}: {
  shopId: string;
  parentId?: string;
  initialBarcode?: string;
  barcodeReadOnly?: boolean;
  disabled?: boolean;
  title?: string;
  submitLabel?: string;
  formLabel?: string;
  savedLabel?: string;
  onCancel?: () => void;
  onSaved: (variant: Variant) => Promise<boolean | void> | boolean | void;
}) {
  const [name, setName] = useState(''),
    [barcode, setBarcode] = useState(initialBarcode),
    [size, setSize] = useState(''),
    [color, setColor] = useState(''),
    [price, setPrice] = useState(''),
    [category, setCategory] = useState(''),
    [subcategory, setSubcategory] = useState(''),
    [description, setDescription] = useState(''),
    [photo, setPhoto] = useState(''),
    [photos, setPhotos] = useState<string[]>([]),
    [categories, setCategories] = useState<CategoryNode[]>([]),
    [busy, setBusy] = useState(false),
    [loadingPhoto, setLoadingPhoto] = useState(false),
    [recognizing, setRecognizing] = useState(false),
    [barcodeBusy, setBarcodeBusy] = useState(false),
    [hint, setHint] = useState(''),
    [error, setError] = useState(''),
    [saved, setSaved] = useState<Variant | null>(null);
  const submitting = useRef(false),
    photoRevision = useRef(0),
    lookupRevision = useRef(0),
    id = useId();
  const updateCategories = useCallback(
    (value: CategoryNode[]) => setCategories(Array.isArray(value) ? value : []),
    [],
  );
  const locked = disabled || busy || loadingPhoto || recognizing || barcodeBusy;
  async function choose(files?: FileList | null) {
    if (!files?.length) return;
    if (files.length > 8) {
      setError('Не более 8 фотографий товара.');
      return;
    }
    const revision = ++photoRevision.current;
    setLoadingPhoto(true);
    setError('');
    setPhoto('');
    setPhotos([]);
    try {
      const data = await Promise.all(Array.from(files).map(photoFrom));
      if (photoRevision.current === revision) {
        setPhotos(data);
        setPhoto(data[0] ?? '');
      }
    } catch (e) {
      if (photoRevision.current === revision) setError(errorText(e));
    } finally {
      if (photoRevision.current === revision) setLoadingPhoto(false);
    }
  }
  async function lookup() {
    const code = barcode.trim();
    if (!/^\d{8,14}$/.test(code)) {
      setHint(
        'Для поиска в каталоге нужен EAN/UPC из 8–14 цифр. Остальные коды можно сохранить вручную.',
      );
      return;
    }
    const revision = ++lookupRevision.current;
    setBarcodeBusy(true);
    setHint('');
    try {
      const result = await api<{
        found: boolean;
        source: string;
        name?: string;
        description?: string;
        existing?: Variant;
      }>(
        `/shops/${shopId}/variants/barcode-suggestion?code=${encodeURIComponent(code)}`,
      );
      if (lookupRevision.current !== revision) return;
      if (result.source === 'shop' && result.existing)
        setHint(
          `Товар уже есть: ${result.existing.name}. Добавьте его через приёмку.`,
        );
      else if (result.found && result.name) {
        setName(result.name);
        if (result.description) setDescription(result.description);
        setHint('Название найдено в каталоге. Проверьте товар и упаковку.');
      } else
        setHint('Товар не найден. Заполните название или используйте фото.');
    } catch {
      if (lookupRevision.current === revision)
        setHint('Поиск недоступен. Можно заполнить товар вручную.');
    } finally {
      if (lookupRevision.current === revision) setBarcodeBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (locked || submitting.current) return;
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
              ...(parentId ? { parentId } : {}),
              ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
              salePriceMinor: parseSom(price),
              ...(size.trim() ? { size: size.trim() } : {}),
              ...(color.trim() ? { color: color.trim() } : {}),
              ...(category ? { category, subcategory } : {}),
              ...(description.trim()
                ? { description: description.trim() }
                : {}),
              ...(photos.length ? { photoDataUrls: photos } : {}),
            },
          });
          setSaved(variant);
        } catch (e) {
          if (e instanceof ApiError && e.status === 409 && barcode.trim()) {
            const existing = await api<Variant>(
              `/shops/${shopId}/variants/by-barcode?code=${encodeURIComponent(barcode.trim())}`,
            );
            setSaved(existing);
            setError(
              'Товар с этим штрихкодом уже существует. Проверьте карточку перед продолжением.',
            );
            return;
          }
          throw e;
        }
      }
      if ((await onSaved(variant)) === false)
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
      className="product-form"
      aria-label={formLabel}
      onSubmit={(e) => void submit(e)}
    >
      {saved ? (
        <section className="product-form-block">
          <h2>Карточка сохранена</h2>
          <p>
            {saved.name} · {formatSom(saved.salePriceMinor)}
          </p>
          <p className="code">{saved.barcode}</p>
        </section>
      ) : (
        <fieldset disabled={locked}>
          <div className="product-form-grid">
            <section className="product-form-block product-form-photo">
              <p className="eyebrow">Фото товара</p>
              <h2>Фото и распознавание</h2>
              <p className="muted">
                Добавьте снимок или заполните данные вручную.
              </p>
              <div className="product-photo-box">
                {photo ? (
                  <img src={photo} alt="Фото перед сохранением" />
                ) : (
                  <div className="product-photo-empty" aria-hidden="true">
                    <span>▧</span>
                    <p>Здесь появится фото товара</p>
                  </div>
                )}
              </div>
              <label>
                Фото товара (камера или файл)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  capture="environment"
                  onChange={(e) => void choose(e.target.files)}
                />
              </label>
              {loadingPhoto && <p role="status">Подготовка фото…</p>}
              {photos.length > 1 && (
                <p className="muted">Выбрано фотографий: {photos.length}</p>
              )}
              <PhotoAssistant
                shopId={shopId}
                photo={photo}
                onBusyChange={setRecognizing}
                onCategories={updateCategories}
                onApply={(s) => {
                  setName(s.name);
                  setDescription(s.description);
                  setCategory(s.category);
                  setSubcategory(s.subcategory);
                }}
              />
            </section>
            <section className="product-form-block">
              <p className="eyebrow">Основные данные</p>
              <h2>{title}</h2>
              <label>
                Название
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например, принтер Xprinter"
                />
              </label>
              <label>
                Штрихкод
                <input
                  maxLength={64}
                  readOnly={barcodeReadOnly}
                  value={barcode}
                  onChange={(e) => {
                    lookupRevision.current++;
                    setBarcodeBusy(false);
                    setBarcode(e.target.value);
                    setHint('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (/^\d{8,14}$/.test(barcode.trim())) void lookup();
                    }
                  }}
                  placeholder="Сканируйте или оставьте пустым"
                />
              </label>
              <div className="product-barcode-tools">
                <p className="muted">
                  Сканер вводит код как клавиатура. Пустое поле — создадим код.
                </p>
                <button
                  type="button"
                  disabled={!barcode.trim() || locked}
                  onClick={() => void lookup()}
                >
                  Найти по штрихкоду
                </button>
              </div>
              {hint && (
                <p role="status" className="notice">
                  {hint}
                </p>
              )}
              <div className="product-form-fields">
                <label>
                  Цена продажи, сом
                  <input
                    required
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
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
              </div>
              <label>
                Подкатегория
                <select
                  value={subcategory}
                  disabled={!category}
                  onChange={(e) => setSubcategory(e.target.value)}
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
              <div className="product-form-fields">
                <label>
                  Размер / вариант
                  <input
                    maxLength={80}
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="Например, M или 42"
                  />
                </label>
                <label>
                  Цвет
                  <input
                    maxLength={80}
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Например, чёрный"
                  />
                </label>
              </div>
              <label htmlFor={id + '-description'}>Описание</label>
              <textarea
                id={id + '-description'}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Особенности товара, размер, материал…"
              />
            </section>
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <footer className="product-form-footer">
        <p className="muted">
          Сохранение создаёт карточку. Количество и закупочную цену укажите в
          приёмке.
        </p>
        <div className="product-form-actions">
          {onCancel && (
            <button type="button" disabled={busy} onClick={onCancel}>
              Отмена
            </button>
          )}
          <button type="submit" className="primary" disabled={locked}>
            {busy ? 'Сохранение…' : saved ? savedLabel : submitLabel}
          </button>
        </div>
      </footer>
    </form>
  );
}
