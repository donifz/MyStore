import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { api, ApiError, errorText } from '../api/client';
import { parseSom, formatSom } from '../api/money';
import type { Variant } from '../api/types';
import PhotoAssistant, { type CategoryNode } from './PhotoAssistant';
import { usePhotoCropQueue } from './use-photo-crop-queue';
import SquareCameraCapture from './SquareCameraCapture';
import { isPurchaseAboveSale, somOrNull } from '../receiving/purchase-warning';
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
  creationKey,
  headerActions,
  footerFields,
  purchaseCostText,
  addToDraftLabel,
  secondarySubmitLabel,
  showCancelInFooter = true,
  receivingLayout = false,
  onCancel,
  onSaved,
  onAddToDraft,
  onSecondarySaved,
  validateBeforeSave,
  validateDraftSave,
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
  creationKey?: string;
  headerActions?: ReactNode;
  footerFields?: ReactNode;
  purchaseCostText?: string;
  addToDraftLabel?: string;
  secondarySubmitLabel?: string;
  showCancelInFooter?: boolean;
  receivingLayout?: boolean;
  validateBeforeSave?: () => void;
  validateDraftSave?: () => void;
  onCancel?: () => void;
  onSaved: (variant: Variant) => Promise<boolean | void> | boolean | void;
  onAddToDraft?: (variant: Variant) => Promise<boolean | void> | boolean | void;
  onSecondarySaved?: (
    variant: Variant,
  ) => Promise<boolean | void> | boolean | void;
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
    [cameraOpen, setCameraOpen] = useState(false),
    [photos, setPhotos] = useState<string[]>([]),
    [categories, setCategories] = useState<CategoryNode[]>([]),
    [extraOpen, setExtraOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [recognizing, setRecognizing] = useState(false),
    [barcodeBusy, setBarcodeBusy] = useState(false),
    [hint, setHint] = useState(''),
    [error, setError] = useState(''),
    [saved, setSaved] = useState<Variant | null>(null);
  const submitting = useRef(false),
    photoRevision = useRef(0),
    lookupRevision = useRef(0),
    productCreationKey = useRef(creationKey ?? crypto.randomUUID()),
    submitIntent = useRef<'primary' | 'draft' | 'secondary'>('primary'),
    cameraInputRef = useRef<HTMLInputElement>(null),
    galleryInputRef = useRef<HTMLInputElement>(null),
    id = useId();
  const updateCategories = useCallback(
    (value: CategoryNode[]) => setCategories(Array.isArray(value) ? value : []),
    [],
  );
  const photoCrop = usePhotoCropQueue((data) => {
    photoRevision.current++;
    setPhotos(data);
    setPhoto(data[0] ?? '');
  });
  const locked =
    disabled ||
    busy ||
    photoCrop.cropping ||
    cameraOpen ||
    recognizing ||
    barcodeBusy;

  function choose(files?: FileList | null) {
    if (!files?.length) return;
    if (files.length > 8) {
      setError('Не более 8 фотографий товара.');
      return;
    }
    setError('');
    photoCrop.choose(files);
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
    const submitter = (e.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    submitIntent.current =
      submitter?.dataset.intent === 'secondary'
        ? 'secondary'
        : submitter?.dataset.intent === 'draft'
          ? 'draft'
          : 'primary';
    if (locked || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (submitIntent.current === 'primary') validateBeforeSave?.();
      if (submitIntent.current === 'draft') validateDraftSave?.();
      let variant = saved;
      if (!variant) {
        if (!name.trim()) throw new Error('Укажите название товара.');
        try {
          variant = await api<Variant>(`/shops/${shopId}/variants`, {
            method: 'POST',
            key: productCreationKey.current,
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
      const afterSave =
        submitIntent.current === 'secondary' && onSecondarySaved
          ? onSecondarySaved
          : submitIntent.current === 'draft' && onAddToDraft
            ? onAddToDraft
            : onSaved;
      if ((await afterSave(variant)) === false)
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
  const barcodeFields = (
    <>
      <label className="product-field-barcode">
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
    </>
  );
  return (
    <form
      className={`product-form product-form-compact${receivingLayout ? ' product-form-receiving' : ''}`}
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
        <fieldset disabled={locked} className="product-form-fieldset">
          <section className="product-form-block product-form-card">
            <div className="product-form-header">
              <div className="product-form-card-head">
                <h2>{title}</h2>
                {onCancel && (
                  <button
                    type="button"
                    className="product-form-close"
                    aria-label="Закрыть карточку"
                    disabled={busy}
                    onClick={onCancel}
                  >
                    ×
                  </button>
                )}
              </div>
              {headerActions}
            </div>
            <div className="product-form-body">
              <div className="product-form-media-row">
                <div className="product-photo-compact">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    aria-label="Снять на камеру"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => void choose(e.target.files)}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    aria-label="Фото товара"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => void choose(e.target.files)}
                  />
                  <div
                    className="product-photo-upload-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => galleryInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        galleryInputRef.current?.click();
                      }
                    }}
                  >
                    {photo ? (
                      <div className="product-photo-preview-wrap">
                        <img src={photo} alt="Фото перед сохранением" />
                        <div className="product-photo-change-bar">
                          <button
                            type="button"
                            className="product-photo-btn"
                            title="Снять другое фото на камеру"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCameraOpen(true);
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              width="12"
                              height="12"
                              aria-hidden="true"
                            >
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            <span>Камера</span>
                          </button>
                          <button
                            type="button"
                            className="product-photo-btn primary"
                            title="Выбрать другое фото из галереи"
                            onClick={(e) => {
                              e.stopPropagation();
                              galleryInputRef.current?.click();
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              width="12"
                              height="12"
                              aria-hidden="true"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                              />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <span>Галерея</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="product-photo-compact-empty">
                        <span
                          className="product-photo-compact-icon"
                          aria-hidden="true"
                        >
                          📷
                        </span>
                        <strong>Фото товара</strong>
                        <div className="product-photo-actions">
                          <button
                            type="button"
                            className="product-photo-btn"
                            title="Снять на камеру"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCameraOpen(true);
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              width="13"
                              height="13"
                              aria-hidden="true"
                            >
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                            <span>Камера</span>
                          </button>
                          <button
                            type="button"
                            className="product-photo-btn primary"
                            title="Выбрать из галереи"
                            onClick={(e) => {
                              e.stopPropagation();
                              galleryInputRef.current?.click();
                            }}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              width="13"
                              height="13"
                              aria-hidden="true"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                              />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <span>Галерея</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {photo && (
                    <button
                      type="button"
                      className="product-photo-remove"
                      aria-label="Удалить фото"
                      onClick={() => {
                        photoRevision.current++;
                        setPhoto('');
                        setPhotos([]);
                      }}
                    >
                      ×
                    </button>
                  )}
                  {photos.length > 1 && (
                    <p className="muted">Выбрано фотографий: {photos.length}</p>
                  )}
                </div>
                <PhotoAssistant
                  shopId={shopId}
                  photo={photo}
                  onBusyChange={setRecognizing}
                  onCategories={updateCategories}
                  inlineForReceiving={receivingLayout}
                  onApply={(s) => {
                    setName(s.name);
                    setDescription(s.description);
                    setCategory(s.category);
                    setSubcategory(s.subcategory);
                  }}
                />
              </div>
              <label className="product-field-name">
                Название
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например, принтер Xprinter XP-365B"
                />
              </label>
              <div className="product-form-fields product-form-pricing-fields">
                <label className="product-field-sale-price">
                  Цена продажи, сом
                  <input
                    required
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                  />
                </label>
                <label className="product-field-category">
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
              {footerFields}
              {barcodeFields}
              <div
                className={`product-form-extra${extraOpen ? ' open' : ''}`}
                onFocusCapture={() => setExtraOpen(true)}
              >
                <button
                  type="button"
                  className="product-form-extra-toggle"
                  aria-expanded={extraOpen}
                  onClick={() => setExtraOpen((open) => !open)}
                >
                  <span
                    className="product-form-extra-chevron"
                    aria-hidden="true"
                  >
                    {extraOpen ? '▴' : '▾'}
                  </span>
                  <span>
                    <strong>Дополнительные поля</strong>
                    <small>Подкатегория, вариант, цвет, описание</small>
                  </span>
                </button>
                <div className="product-form-extra-body">
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
                </div>
              </div>
            </div>
          </section>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <footer className="product-form-footer">
        {purchaseCostText &&
          isPurchaseAboveSale(
            purchaseCostText,
            saved?.salePriceMinor ?? somOrNull(price),
          ) && (
            <p role="status" className="notice">
              Закупочная цена за штуку выше цены продажи. Проверьте цены:
              продажа может быть убыточной.
            </p>
          )}
        <div className="product-form-actions">
          {addToDraftLabel && !saved && (
            <button
              type="submit"
              className="primary product-form-draft-btn"
              data-intent="draft"
              disabled={locked}
            >
              <span aria-hidden="true">+ </span>
              {addToDraftLabel}
            </button>
          )}
          <button type="submit" className="primary" disabled={locked}>
            {busy ? 'Сохранение…' : saved ? savedLabel : submitLabel}
          </button>
          {secondarySubmitLabel && !saved && (
            <button
              type="submit"
              formNoValidate
              className="secondary"
              data-intent="secondary"
              disabled={locked}
            >
              {secondarySubmitLabel}
            </button>
          )}
          {onCancel && showCancelInFooter && (
            <button type="button" disabled={busy} onClick={onCancel}>
              Отмена
            </button>
          )}
        </div>
      </footer>
      {photoCrop.cropDialog}
      {cameraOpen && (
        <SquareCameraCapture
          onClose={() => setCameraOpen(false)}
          onFallback={() => cameraInputRef.current?.click()}
          onPhoto={(data) => {
            photoRevision.current++;
            setPhotos([data]);
            setPhoto(data);
          }}
        />
      )}
    </form>
  );
}
