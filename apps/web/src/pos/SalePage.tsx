import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Page, Variant } from '../api/types';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { formatSom, parseSom } from '../api/money';
import { useDocument } from '../drafts/use-document';
import DocumentEditor from '../drafts/DocumentEditor';
import CameraScanner from '../scanner/CameraScanner';
import { useCurrentShift } from './use-current-shift';

const POPULAR = '__popular__';
const wholeSom = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Round-up cash suggestions above the total, e.g. 420 → 500, 1 000, 5 000. */
export function quickCashAmounts(sumMinor: bigint): number[] {
  if (sumMinor <= 0n) return [];
  const result = new Set<number>();
  for (const step of [10000n, 50000n, 100000n, 500000n]) {
    const rounded = ((sumMinor + step - 1n) / step) * step;
    if (rounded > sumMinor && rounded <= BigInt(Number.MAX_SAFE_INTEGER))
      result.add(Number(rounded));
  }
  return [...result].sort((a, b) => a - b).slice(0, 3);
}

function Icon({
  name,
}: {
  name:
    | 'search'
    | 'barcode'
    | 'camera'
    | 'clock'
    | 'cash'
    | 'card'
    | 'grid'
    | 'trash'
    | 'receipt';
}) {
  const paths: Record<typeof name, ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    barcode: <path d="M4 5v14M7 5v14M11 5v14M14 5v14M17 5v14M20 5v14" />,
    camera: (
      <>
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    cash: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
    receipt: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  };
  return (
    <svg
      className="pos-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function SaleWorkspace({ shopId, userId }: { shopId: string; userId: string }) {
  const doc = useDocument({ userId, shopId, kind: 'sale' }),
    [method, setMethod] = useState<'cash' | 'card'>('cash'),
    shift = useCurrentShift(shopId, doc.success),
    [query, setQuery] = useState(''),
    [loadedQuery, setLoadedQuery] = useState<string | null>(null),
    [category, setCategory] = useState(''),
    [categories, setCategories] = useState<{ name: string; count: number }[]>(
      [],
    ),
    [products, setProducts] = useState<Variant[]>([]),
    [catalogError, setCatalogError] = useState(''),
    [received, setReceived] = useState(''),
    [camera, setCamera] = useState(false),
    scanInput = useRef<HTMLInputElement>(null),
    photos = useRef(new Map<string, string>());
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      const filter =
        category === POPULAR
          ? '&sort=popular'
          : category
            ? `&category=${encodeURIComponent(category)}`
            : '';
      void api<
        Page<Variant> & { categories?: { name: string; count: number }[] }
      >(
        `/shops/${shopId}/variants?q=${encodeURIComponent(query)}&page=1&pageSize=24&facets=true${filter}`,
      )
        .then((result) => {
          if (alive) {
            const items = result.items.filter((item) => !item.archived);
            for (const item of items)
              if (item.photoUrl) photos.current.set(item.id, item.photoUrl);
            setProducts(items);
            if (result.categories) setCategories(result.categories);
            setLoadedQuery(query);
            setCatalogError('');
          }
        })
        .catch(() => {
          if (alive) setCatalogError('Не удалось загрузить товары.');
        });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [shopId, query, category, doc.success]);
  useEffect(() => {
    if (doc.success) setReceived('');
  }, [doc.success]);
  const active = shift.current && 'id' in shift.current ? shift.current : null;
  const sum = doc.draft.lines.reduce(
      (n, l) =>
        n + BigInt(l.quantity) * BigInt(l.priceMinor - (l.discountMinor || 0)),
      0n,
    ),
    safe = sum <= BigInt(Number.MAX_SAFE_INTEGER);
  const itemCount = doc.draft.lines.reduce((n, l) => n + l.quantity, 0);
  const inCart = new Map(doc.draft.lines.map((l) => [l.id, l.quantity]));
  async function submit() {
    if (doc.draft.submission) {
      await doc.send(`/shops/${shopId}/pos/sales`, doc.draft.submission.body);
      return;
    }
    if (!active) {
      doc.setError('Сначала откройте свою смену.');
      return;
    }
    if (!safe) {
      doc.setError('Сумма слишком велика.');
      return;
    }
    if (method === 'cash' && received.trim()) {
      if (receivedError || receivedMinor === null) {
        doc.setError('Укажите корректную полученную сумму.');
        return;
      }
      if (BigInt(receivedMinor) < sum) {
        doc.setError('Полученных наличных недостаточно для продажи.');
        return;
      }
    }
    const missingReason = doc.draft.lines.find(
      (l) => (l.discountMinor || 0) > 0 && !l.discountReason?.trim(),
    );
    if (missingReason) {
      doc.setError(`Укажите причину скидки для "${missingReason.name}".`);
      return;
    }
    await doc.send(`/shops/${shopId}/pos/sales`, {
      shiftId: active.id,
      method,
      lines: doc.draft.lines.map((l) => ({
        variantId: l.id,
        quantity: l.quantity,
        expectedUnitPriceMinor: l.priceMinor - (l.discountMinor || 0),
        ...(l.discountMinor
          ? {
              discountMinor: l.discountMinor,
              discountReason: l.discountReason?.trim(),
            }
          : {}),
      })),
    });
  }
  function scanOrSearch(raw: string) {
    const value = raw.trim();
    if (!value) return;
    // Names (Cyrillic or several words) stay a search; codes go to the scanner queue.
    if (/[\sа-яё]/i.test(value)) {
      if (loadedQuery === raw && products.length === 1) {
        void doc.addVariant(products[0]);
        setQuery('');
      }
      return;
    }
    doc.scan(value);
    setQuery('');
  }
  const paymentMethod = doc.draft.submission?.body.method ?? method;
  let receivedMinor: number | null = null;
  let receivedError = '';
  if (received.trim()) {
    try {
      receivedMinor = parseSom(received);
    } catch (e) {
      receivedError = e instanceof Error ? e.message : 'Проверьте сумму.';
    }
  }
  const changeMinor =
    safe && paymentMethod === 'cash' && receivedMinor !== null
      ? BigInt(receivedMinor) - sum
      : null;
  const locked = doc.busy || doc.blocked || !!doc.draft.submission;
  const scanDisabled = locked || !!doc.productCreation;
  const totalText = safe ? formatSom(Number(sum)) : 'Сумма превышена';
  const canSubmit = !(
    doc.busy ||
    doc.blocked ||
    !doc.online ||
    !doc.draft.lines.length ||
    (!doc.draft.submission &&
      (!active ||
        !safe ||
        (paymentMethod === 'cash' &&
          !!received.trim() &&
          (!!receivedError || changeMinor === null || changeMinor < 0n))))
  );
  return (
    <div className="pos-page">
      <div className="pos-header">
        <div className="pos-title">
          <h1>Касса</h1>
          <p className="muted">Продажи в торговой точке</p>
        </div>
        {!shift.loading && !active && (
          <div className="pos-shift-banner warning">
            <Icon name="clock" />
            <span>
              {shift.current
                ? 'Касса занята другим сотрудником.'
                : 'Смена не открыта. Откройте её перед продажей.'}
            </span>
            <Link
              className="button primary"
              to={'/seller/' + shopId + '/shift'}
            >
              {shift.current ? 'Посмотреть смену' : 'Открыть смену'}
            </Link>
          </div>
        )}
        {active && (
          <div className="pos-shift-banner ok">
            <span className="pos-dot" aria-hidden="true" />
            <span>Смена открыта, можно продавать</span>
            <Link className="button" to={'/seller/' + shopId + '/shift'}>
              Моя смена
            </Link>
          </div>
        )}
      </div>
      {shift.error && (
        <p role="alert" className="error">
          {shift.error}
        </p>
      )}
      <div className="pos-layout">
        <section
          className="pos-panel pos-catalog"
          aria-label="Каталог для кассы"
        >
          <h2 className="pos-panel-title">Поиск товара</h2>
          <div className="pos-search-row">
            <label className="pos-search">
              <Icon name="search" />
              <input
                ref={scanInput}
                type="search"
                autoFocus
                autoComplete="off"
                aria-label="Сканировать штрихкод"
                value={query}
                disabled={scanDisabled}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    scanOrSearch(event.currentTarget.value);
                  }
                }}
                placeholder="Название, артикул или штрихкод"
              />
            </label>
            <button
              type="button"
              className="pos-tool"
              aria-label="Фокус для сканера"
              title="USB-сканер вводит код как клавиатура: один скан — одна единица"
              disabled={scanDisabled}
              onClick={() => scanInput.current?.focus()}
            >
              <Icon name="barcode" />
              <span>Сканер</span>
            </button>
            <button
              type="button"
              className="pos-tool"
              aria-label="Сканировать камерой"
              disabled={scanDisabled}
              onClick={() => setCamera(true)}
            >
              <Icon name="camera" />
              <span>Камера</span>
            </button>
          </div>
          {camera && (
            <CameraScanner
              onScan={(code) => {
                doc.scan(code);
                setCamera(false);
              }}
              onClose={() => setCamera(false)}
            />
          )}
          <div className="pos-chips" role="group" aria-label="Категории">
            {[
              { value: '', label: 'Все товары' },
              { value: POPULAR, label: 'Часто продаются' },
              ...categories.map((c) => ({ value: c.name, label: c.name })),
            ].map((chip) => (
              <button
                type="button"
                key={chip.value || 'all'}
                className={
                  category === chip.value ? 'pos-chip selected' : 'pos-chip'
                }
                aria-pressed={category === chip.value}
                onClick={() => setCategory(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {catalogError && (
            <p role="alert" className="error">
              {catalogError}
            </p>
          )}
          {!catalogError && products.length === 0 && (
            <p className="empty-state">
              {category === POPULAR
                ? 'За последние 30 дней продаж ещё не было.'
                : 'Товары не найдены. Отсканируйте штрихкод или измените поиск.'}
            </p>
          )}
          <div className="pos-product-grid">
            {products.map((product) => {
              const out = (product.available ?? 1) <= 0;
              const qty = inCart.get(product.id);
              return (
                <button
                  type="button"
                  className={
                    qty ? 'pos-product-card in-cart' : 'pos-product-card'
                  }
                  key={product.id}
                  disabled={locked || !doc.online || out}
                  onClick={() => void doc.addVariant(product)}
                >
                  <span className="pos-product-photo" aria-hidden="true">
                    {product.photoUrl ? (
                      <img src={product.photoUrl} alt="" loading="lazy" />
                    ) : (
                      <Icon name="grid" />
                    )}
                    {qty ? (
                      <span className="pos-product-qty">{qty}</span>
                    ) : null}
                  </span>
                  <span className="pos-product-info">
                    <strong>{product.name}</strong>
                    <small>Арт. {product.sku || product.barcode}</small>
                    <small
                      className={
                        out
                          ? 'pos-stock out'
                          : (product.available ?? 99) <= 5
                            ? 'pos-stock low'
                            : 'pos-stock'
                      }
                    >
                      {product.available === undefined
                        ? product.barcode
                        : out
                          ? 'Нет в наличии'
                          : `Доступно: ${product.available}`}
                    </small>
                  </span>
                  <span className="pos-product-foot">
                    <span className="pos-product-price">
                      {formatSom(product.salePriceMinor)}
                    </span>
                    <span className="pos-product-add" aria-hidden="true">
                      +
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="pos-side">
          <aside className="pos-panel pos-payment">
            <fieldset className="pos-methods" disabled={locked}>
              <legend className="pos-panel-title">Способ оплаты</legend>
              {(
                [
                  ['cash', 'Наличные', 'cash'],
                  ['card', 'Банковская карта', 'card'],
                ] as const
              ).map(([value, label, icon]) => (
                <label
                  key={value}
                  className={
                    paymentMethod === value
                      ? 'pos-method selected'
                      : 'pos-method'
                  }
                >
                  <input
                    type="radio"
                    name="cashier-method"
                    value={value}
                    checked={paymentMethod === value}
                    onChange={() => setMethod(value)}
                  />
                  <Icon name={icon} />
                  {label}
                </label>
              ))}
            </fieldset>
            {paymentMethod === 'cash' && (
              <div className="pos-cash-row">
                <label className="pos-received">
                  Получено от покупателя, сом
                  <input
                    inputMode="decimal"
                    value={received}
                    disabled={locked}
                    placeholder="Например, 1000"
                    onChange={(event) => setReceived(event.target.value)}
                  />
                </label>
                <div className="pos-quick">
                  <span className="pos-quick-label">Быстрая сумма</span>
                  <div className="pos-quick-buttons">
                    <button
                      type="button"
                      className={
                        receivedMinor !== null && BigInt(receivedMinor) === sum
                          ? 'pos-quick-button selected'
                          : 'pos-quick-button'
                      }
                      disabled={locked || !safe || sum === 0n}
                      onClick={() =>
                        setReceived((Number(sum) / 100).toString())
                      }
                    >
                      Без сдачи
                    </button>
                    {quickCashAmounts(safe ? sum : 0n).map((amount) => (
                      <button
                        type="button"
                        key={amount}
                        className={
                          receivedMinor === amount
                            ? 'pos-quick-button selected'
                            : 'pos-quick-button'
                        }
                        disabled={locked}
                        onClick={() => setReceived((amount / 100).toString())}
                      >
                        {wholeSom.format(amount / 100).replace(/\u00a0/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {receivedError && (
              <p role="alert" className="error">
                {receivedError}
              </p>
            )}
            <div className="pos-totals">
              <div className="pos-total-tile">
                <span>Итого</span>
                <strong>{totalText}</strong>
              </div>
              {paymentMethod === 'cash' && (
                <div
                  className={
                    changeMinor !== null && changeMinor < 0n
                      ? 'pos-total-tile short'
                      : 'pos-total-tile change'
                  }
                  {...(changeMinor !== null ? { role: 'status' } : {})}
                >
                  <span>
                    {changeMinor !== null && changeMinor < 0n
                      ? 'Не хватает'
                      : 'Сдача'}
                  </span>
                  <strong>
                    {changeMinor === null
                      ? '—'
                      : formatSom(
                          Number(
                            changeMinor >= 0n ? changeMinor : -changeMinor,
                          ),
                        )}
                  </strong>
                </div>
              )}
            </div>
            <button
              className="pos-submit"
              onClick={() => void submit()}
              disabled={!canSubmit}
            >
              <Icon name="receipt" />
              <span>
                {doc.busy
                  ? 'Проведение…'
                  : doc.draft.submission
                    ? 'Повторить исходный запрос'
                    : 'Провести продажу'}
              </span>
              {!doc.busy && !doc.draft.submission && (
                <span className="pos-submit-sum" aria-hidden="true">
                  {totalText}
                </span>
              )}
            </button>
            <p className="muted pos-hint">
              Проводите продажу только после получения денег. Оплата картой
              отмечается вручную.
            </p>
          </aside>
          <section className="pos-panel pos-cart" aria-label="Корзина">
            <div className="pos-cart-head">
              <h2 className="pos-panel-title">
                Корзина <span className="pos-count">{itemCount}</span>
              </h2>
              <button
                type="button"
                className="pos-clear"
                disabled={locked || !doc.draft.lines.length}
                onClick={() => void doc.change([])}
              >
                <Icon name="trash" />
                Очистить
              </button>
            </div>
            <DocumentEditor
              doc={doc}
              receiving={false}
              shopId={shopId}
              cart
              photoFor={(id) => photos.current.get(id)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
export default function SalePage() {
  const { shopId } = useParams(),
    session = useSession();
  return (
    <SaleWorkspace
      key={shopId + session.user!.userId}
      shopId={shopId!}
      userId={session.user!.userId}
    />
  );
}
