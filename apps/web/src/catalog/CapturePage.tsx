import { FormEvent, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { useDocument } from '../drafts/use-document';
import { parseSom, formatSom } from '../api/money';
import { api, errorText } from '../api/client';
import { Variant } from '../api/types';
import PhotoAssistant from './PhotoAssistant';
import type { CategoryNode } from './PhotoAssistant';
import BarcodeLabel from './BarcodeLabel';
async function photoFrom(file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw Error('Выберите JPEG, PNG или WebP размером до 20 МБ.');
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 16000000)
      throw Error('Фото слишком большое. Выберите снимок до 16 мегапикселей.');
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 1024 / image.width, 1024 / image.height);
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Камера недоступна в этом браузере.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.8);
    if (data.length > 699074)
      throw Error('Фото слишком большое. Сделайте более простой снимок.');
    return data;
  } finally {
    image.close();
  }
}
type CaptureBody = {
  name: string;
  unitCostMinor: number;
  salePriceMinor: number;
  quantity: number;
  photoDataUrl: string;
  barcode?: string;
  category: string;
  subcategory: string;
  description: string;
};
function CaptureWorkspace({
  shopId,
  userId,
}: {
  shopId: string;
  userId: string;
}) {
  const doc = useDocument({ shopId, userId, kind: 'capture' }),
    [name, setName] = useState(''),
    [cost, setCost] = useState(''),
    [price, setPrice] = useState(''),
    [quantity, setQuantity] = useState('1'),
    [barcode, setBarcode] = useState(''),
    [barcodeBusy, setBarcodeBusy] = useState(false),
    [barcodeHint, setBarcodeHint] = useState(''),
    [category, setCategory] = useState(''),
    [subcategory, setSubcategory] = useState(''),
    [description, setDescription] = useState(''),
    [photo, setPhoto] = useState(''),
    [loadingPhoto, setLoadingPhoto] = useState(false),
    [recognizing, setRecognizing] = useState(false),
    [categories, setCategories] = useState<CategoryNode[]>([]),
    [review, setReview] = useState<CaptureBody | null>(null),
    [saved, setSaved] = useState<(Variant & { quantity: number }) | null>(null);
  const photoRevision = useRef(0),
    pending = doc.draft.submission,
    body = (pending?.body ?? review) as CaptureBody | null;
  async function choose(file: File | undefined) {
    if (!file) return;
    const revision = ++photoRevision.current;
    setLoadingPhoto(true);
    setPhoto('');
    doc.setError('');
    try {
      const data = await photoFrom(file);
      if (revision === photoRevision.current) setPhoto(data);
    } catch (e) {
      doc.setError(errorText(e));
    } finally {
      if (revision === photoRevision.current) setLoadingPhoto(false);
    }
  }
  async function searchBarcode() {
    const code = barcode.trim();
    setBarcodeHint('');
    if (!/^\\d{8,14}$/.test(code)) {
      setBarcodeHint('Для поиска в каталоге нужен EAN/UPC из 8–14 цифр.');
      return;
    }
    setBarcodeBusy(true);
    try {
      const result = await api<{
        found: boolean;
        source: 'shop' | 'openfoodfacts' | 'none';
        name?: string;
        brand?: string;
        description?: string;
        existing?: Variant;
      }>(`/shops/${shopId}/variants/barcode-suggestion?code=${encodeURIComponent(code)}`);
      if (result.source === 'shop' && result.existing) {
        setBarcodeHint(`Товар уже есть в этом магазине: ${result.existing.name}. Добавьте его через обычную приёмку.`);
      } else if (result.found && result.name) {
        setName(result.name);
        if (result.description) setDescription(result.description);
        setBarcodeHint(`Найдено в Open Food Facts. Проверьте название и упаковку перед сохранением.`);
      } else {
        setBarcodeHint('Во внешнем каталоге товар не найден. Используйте фото или введите название вручную.');
      }
    } catch (e) {
      setBarcodeHint('Поиск недоступен. Можно заполнить товар вручную.');
    } finally {
      setBarcodeBusy(false);
    }
  }
  function check(e: FormEvent) {
    e.preventDefault();
    doc.setError('');
    try {
      const n = Number(quantity);
      if (
        !photo ||
        !name.trim() ||
        !Number.isSafeInteger(n) ||
        n < 1 ||
        n > 1000000
      )
        throw Error('Добавьте фото, название и количество от 1 до 1000000.');
      setReview({
        name: name.trim(),
        unitCostMinor: parseSom(cost),
        salePriceMinor: parseSom(price),
        quantity: n,
        photoDataUrl: photo,
        ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
        category,
        subcategory,
        description,
      });
    } catch (e) {
      doc.setError(errorText(e));
    }
  }
  async function confirm() {
    if (!body) return;
    const result = await doc.send(`/shops/${shopId}/variants/capture`, body);
    if (result) {
      setSaved(result as Variant & { quantity: number });
      setReview(null);
      setPhoto('');
    }
  }
  return (
    <>
      <Link className="back-link" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <h1>Скан / фото товара</h1>
      <p className="muted">
        Сфотографируйте товар и укажите цены. Артикул и штрихкод создадим после
        подтверждения.
      </p>
      {doc.error && (
        <p className="error" role="alert">
          {doc.error}
        </p>
      )}
      {saved ? (
        <section className="panel capture-panel barcode-print-container">
          <p role="status" className="success">
            Товар создан и принят: {saved.quantity} шт.
          </p>
          <h2>{saved.name}</h2>
          {saved.photoUrl && (
            <img
              className="capture-photo"
              src={saved.photoUrl}
              alt="Сохранённое фото"
            />
          )}
          <p>Артикул: {saved.sku}</p>
          <p>Штрихкод: {saved.barcode}</p>
          <p>Цена продажи: {formatSom(saved.salePriceMinor)}</p>
          <BarcodeLabel product={saved} />
          <button
            onClick={() => {
              setSaved(null);
              setName('');
              setCost('');
              setPrice('');
              setQuantity('1');
              setBarcode('');
              setCategory('');
              setDescription('');
            }}
          >
            Следующий товар
          </button>
        </section>
      ) : body ? (
        <section className="panel capture-panel">
          <h2>Подтвердите товар</h2>
          <img
            className="capture-photo"
            src={body.photoDataUrl}
            alt="Фото перед сохранением"
          />
          <h3>{body.name}</h3>
          <p>Закупочная цена: {formatSom(body.unitCostMinor)}</p>
          <p>Цена продажи: {formatSom(body.salePriceMinor)}</p>
          <p>Количество: {body.quantity} шт.</p>
          <p>Штрихкод: {body.barcode || 'Автоматически'}</p>
          <p>Артикул: автоматически</p>
          {body.category && <p>{body.category}</p>}
          {body.description && <p>{body.description}</p>}
          {pending && (
            <p role="alert">
              Результат сохранения пока неизвестен. Повтор отправит те же данные
              и не создаст дубликат.
            </p>
          )}
          <button
            className="primary"
            disabled={doc.busy || doc.blocked || !doc.online}
            onClick={() => void confirm()}
          >
            {doc.busy
              ? 'Сохранение…'
              : pending
                ? 'Повторить сохранение'
                : 'Подтвердить и принять товар'}
          </button>
          {!pending && (
            <button disabled={doc.busy} onClick={() => setReview(null)}>
              Исправить
            </button>
          )}
        </section>
      ) : (
        <form className="panel capture-panel" onSubmit={check}>
          <fieldset
            disabled={doc.busy || loadingPhoto || recognizing || barcodeBusy || doc.blocked}
          >
            <label>
              Фото товара
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => void choose(e.target.files?.[0])}
              />
            </label>
            {loadingPhoto && <p role="status">Подготовка фото…</p>}
            {photo && (
              <img
                className="capture-photo"
                src={photo}
                alt="Фото перед сохранением"
              />
            )}
            <PhotoAssistant
              shopId={shopId}
              photo={photo}
              onBusyChange={setRecognizing}
              onCategories={setCategories}
              onApply={(suggestion) => {
                setName(suggestion.name);
                setDescription(suggestion.description);
                setCategory(suggestion.category);
                setSubcategory(suggestion.subcategory);
              }}
            />
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
              Закупочная цена, сом
              <input
                required
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
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
              Количество
              <input
                required
                type="number"
                min="1"
                max="1000000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <label>
              Штрихкод
              <input
                maxLength={64}
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setBarcodeHint('');
                }}
                placeholder="Сканируйте существующий или оставьте пустым"
              />
            </label>
            <button type="button" onClick={() => void searchBarcode()} disabled={!barcode.trim() || barcodeBusy}>
              {barcodeBusy ? 'Ищем товар…' : 'Найти по штрихкоду'}
            </button>
            {barcodeHint && <p role="status" className="muted">{barcodeHint}</p>
            <label>
              Категория
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setSubcategory('');
                }}
              >
                <option value="">Выберите категорию</option>
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
            <div className="capture-field">
              <label htmlFor="capture-description">Описание</label>
              <textarea
                id="capture-description"
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <p className="muted">
              При подтверждении товар поступит в учёт по закупочной цене. Для
              публикации на сайте магазин должен быть опубликован.
            </p>
            <button className="primary" disabled={!photo || loadingPhoto}>
              Проверить товар
            </button>
          </fieldset>
        </form>
      )}
    </>
  );
}
export default function CapturePage() {
  const { shopId } = useParams(),
    session = useSession(),
    shop = session.user?.shops.find((s) => s.id === shopId);
  if (!shop || !session.user || shop.role === 'cashier')
    return <p role="alert">Недостаточно прав для приёмки товара.</p>;
  return (
    <CaptureWorkspace
      key={shop.id + session.user.userId}
      shopId={shop.id}
      userId={session.user.userId}
    />
  );
}
