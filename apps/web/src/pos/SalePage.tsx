import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { Page, Variant } from '../api/types';
import { useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { formatSom, parseSom } from '../api/money';
import { useDocument } from '../drafts/use-document';
import DocumentEditor from '../drafts/DocumentEditor';
import CameraScanner from '../scanner/CameraScanner';
import { useCurrentShift } from './use-current-shift';
import PaymentBottomSheet from './PaymentBottomSheet';
import {
  allocateCheckoutDiscount,
  parseCheckoutDiscount,
  type CheckoutDiscountMode,
} from './checkout-discount';
import ShiftQuickModal from './ShiftQuickModal';

const POPULAR = '__popular__';
const loyaltyEnabled =
  import.meta.env.DEV || import.meta.env.VITE_LOYALTY_ENABLED === 'true';
const creditSalesEnabled =
  import.meta.env.DEV || import.meta.env.VITE_CREDIT_SALES_ENABLED === 'true';

/** Round-up cash suggestions above the total, e.g. 420 → 500, 1 000, 2 000, 5 000. */
export function quickCashAmounts(sumMinor: bigint): number[] {
  if (sumMinor <= 0n) return [];
  const result = new Set<number>();
  for (const step of [10000n, 50000n, 100000n, 200000n, 500000n]) {
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
    | 'eye'
    | 'clock'
    | 'cash'
    | 'card'
    | 'grid'
    | 'trash'
    | 'receipt'
    | 'close';
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
    eye: (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
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
    close: <path d="M18 6 6 18M6 6l12 12" />,
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

function ProductPhoto({ product, qty }: { product: Variant; qty?: number }) {
  const photo = product.photoUrls?.find(Boolean) || product.photoUrl;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  return (
    <span className="pos-product-photo" aria-hidden="true">
      {photo && !failed ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="grid" />
      )}
      {qty ? <span className="pos-product-qty">{qty}</span> : null}
    </span>
  );
}

function SaleWorkspace({
  shopId,
  shopName,
  userId,
}: {
  shopId: string;
  shopName?: string;
  userId: string;
}) {
  const doc = useDocument({ userId, shopId, kind: 'sale' }),
    [method, setMethod] = useState<'cash' | 'card'>('cash'),
    [shiftRevision, setShiftRevision] = useState(0),
    shift = useCurrentShift(shopId, `${doc.success}:${shiftRevision}`),
    [query, setQuery] = useState(''),
    [loadedQuery, setLoadedQuery] = useState<string | null>(null),
    [category, setCategory] = useState(''),
    [categories, setCategories] = useState<{ name: string; count: number }[]>(
      [],
    ),
    [products, setProducts] = useState<Variant[]>([]),
    [catalogError, setCatalogError] = useState(''),
    [received, setReceived] = useState(''),
    [checkoutDiscountText, setCheckoutDiscountText] = useState(''),
    [checkoutDiscountMode, setCheckoutDiscountMode] =
      useState<CheckoutDiscountMode>('som'),
    [creditMode, setCreditMode] = useState(false),
    [loyaltyToken, setLoyaltyToken] = useState(''),
    [redeemPoints, setRedeemPoints] = useState(0),
    [creditCustomerId, setCreditCustomerId] = useState(''),
    [creditCustomerEligible, setCreditCustomerEligible] = useState(false),
    [creditPaidText, setCreditPaidText] = useState('0'),
    [creditDueOn, setCreditDueOn] = useState(() =>
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    ),
    [camera, setCamera] = useState(false),
    [showCost, setShowCost] = useState(true),
    [scannerFocused, setScannerFocused] = useState(true),
    [paymentSheetOpen, setPaymentSheetOpen] = useState(false),
    [shiftModalOpen, setShiftModalOpen] = useState(false),
    [lastReceipt, setLastReceipt] = useState<{
      shopName: string;
      method: 'cash' | 'card';
      totalMinor: number;
      createdAt: string;
      lines: Array<{
        name: string;
        quantity: number;
        unitPriceMinor: number;
        discountMinor: number;
      }>;
    } | null>(null),
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
            for (const item of items) {
              const photo = item.photoUrls?.find(Boolean) || item.photoUrl;
              if (photo) photos.current.set(item.id, photo);
            }
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
    if (doc.success) {
      setReceived('');
      setQuery('');
      scanInput.current?.focus();
    }
  }, [doc.success]);

  useEffect(() => {
    const keepFocus = () => {
      if (shiftModalOpen || paymentSheetOpen || camera) return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }
      requestAnimationFrame(() => {
        const currentActive = document.activeElement;
        if (
          currentActive &&
          (currentActive.tagName === 'INPUT' ||
            currentActive.tagName === 'TEXTAREA' ||
            currentActive.tagName === 'SELECT' ||
            currentActive.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        scanInput.current?.focus({ preventScroll: true });
        setScannerFocused(true);
      });
    };

    const handleGlobalClick = (event: MouseEvent) => {
      if (shiftModalOpen || paymentSheetOpen || camera) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], .pos-stepper, .pos-cart-discount, .pos-sheet-root, [role="dialog"]',
        )
      ) {
        return;
      }
      keepFocus();
    };

    const handleWindowFocus = (event: FocusEvent) => {
      if (event.target !== window && event.target !== document) return;
      keepFocus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        keepFocus();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shiftModalOpen, paymentSheetOpen, camera]);

  const active = shift.current && 'id' in shift.current ? shift.current : null;
  const sum = doc.draft.lines.reduce(
      (n, l) =>
        n + BigInt(l.quantity) * BigInt(l.priceMinor - (l.discountMinor || 0)),
      0n,
    ),
    safe = sum <= BigInt(Number.MAX_SAFE_INTEGER);
  const totalMinor = safe ? Number(sum) : 0;
  const checkoutDiscount = parseCheckoutDiscount(
    checkoutDiscountText,
    checkoutDiscountMode,
    totalMinor,
  );
  const checkoutLines = checkoutDiscount.error
    ? null
    : allocateCheckoutDiscount(doc.draft.lines, checkoutDiscount.minor);
  const checkoutDiscountError =
    checkoutDiscount.error ||
    (checkoutLines === null
      ? 'Невозможно точно распределить скидку по товарам. Уменьшите сумму.'
      : '');
  const afterCheckoutDiscount = sum - BigInt(checkoutDiscount.minor);
  const validLoyalty =
    (!loyaltyToken && redeemPoints === 0) ||
    (/^[A-Za-z0-9_-]{43}$/.test(loyaltyToken) &&
      Number.isSafeInteger(redeemPoints) &&
      redeemPoints >= 0 &&
      BigInt(redeemPoints) * 500n <= afterCheckoutDiscount);
  const bonusDiscountMinor =
    loyaltyEnabled && !creditMode && loyaltyToken && validLoyalty
      ? BigInt(redeemPoints) * 100n
      : 0n;
  const payableMinor = afterCheckoutDiscount - bonusDiscountMinor;
  const totalText = safe ? formatSom(Number(payableMinor)) : 'Сумма превышена';
  const itemCount = doc.draft.lines.reduce((n, l) => n + l.quantity, 0);
  const inCart = new Map(doc.draft.lines.map((l) => [l.id, l.quantity]));

  function startNewReceipt() {
    void doc.change([]);
    doc.setError('');
    setReceived('');
    setCheckoutDiscountText('');
    setCheckoutDiscountMode('som');
    setCreditMode(false);
    setLoyaltyToken('');
    setRedeemPoints(0);
    setCreditCustomerId('');
    setCreditCustomerEligible(false);
    setCreditPaidText('0');
    setQuery('');
    setPaymentSheetOpen(false);
    scanInput.current?.focus();
  }

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
    if (checkoutDiscountError || !checkoutLines) {
      doc.setError(checkoutDiscountError || 'Некорректная скидка.');
      return;
    }
    if (!creditMode && !validLoyalty) {
      doc.setError('Проверьте QR покупателя и число бонусных баллов.');
      return;
    }
    if (!creditMode && method === 'cash' && received.trim()) {
      if (receivedError || receivedMinor === null) {
        doc.setError('Укажите корректную полученную сумму.');
        return;
      }
      if (BigInt(receivedMinor) < payableMinor) {
        doc.setError('Полученных наличных недостаточно для продажи.');
        return;
      }
    }
    const missingReason = checkoutLines.find(
      (l) => (l.discountMinor || 0) > 0 && !l.discountReason?.trim(),
    );
    if (missingReason) {
      doc.setError(`Укажите причину скидки для "${missingReason.name}".`);
      return;
    }
    if (
      creditMode &&
      (!creditCustomerId ||
        !creditCustomerEligible ||
        creditDebtMinor === null ||
        creditDebtMinor <= 0 ||
        !creditDueOn)
    ) {
      doc.setError('Укажите покупателя, сумму оплаты и срок возврата.');
      return;
    }
    await doc.send(
      creditMode
        ? `/shops/${shopId}/pos/credit-sales`
        : `/shops/${shopId}/pos/sales`,
      {
        shiftId: active.id,
        method,
        ...(!creditMode && loyaltyEnabled && loyaltyToken
          ? { loyaltyToken, redeemPoints }
          : {}),
        ...(creditMode
          ? {
              customerId: creditCustomerId,
              paidMinor: creditPaidMinor,
              dueOn: creditDueOn,
            }
          : {}),
        lines: checkoutLines.map((l) => ({
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
      },
    );
  }

  function scanOrSearch(raw: string) {
    const value = raw.trim();
    if (!value) return;
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

  let creditPaidMinor: number | null = null;
  if (creditMode) {
    try {
      creditPaidMinor = parseSom(creditPaidText.trim() || '0');
    } catch {
      creditPaidMinor = null;
    }
  }
  const creditDebtMinor =
    creditMode &&
    creditPaidMinor !== null &&
    creditPaidMinor < Number(afterCheckoutDiscount)
      ? Number(afterCheckoutDiscount) - creditPaidMinor
      : null;

  const changeMinor =
    safe && paymentMethod === 'cash' && receivedMinor !== null
      ? BigInt(receivedMinor) - payableMinor
      : null;

  const locked = doc.busy || doc.blocked || !!doc.draft.submission;
  const scanDisabled = locked || !!doc.productCreation;
  const canSubmit = !(
    doc.busy ||
    doc.blocked ||
    !doc.online ||
    !doc.draft.lines.length ||
    (!doc.draft.submission &&
      (!active ||
        !safe ||
        !!checkoutDiscountError ||
        (!creditMode && !validLoyalty) ||
        (creditMode &&
          (!creditCustomerId ||
            !creditCustomerEligible ||
            creditDebtMinor === null ||
            !creditDueOn)) ||
        (!creditMode &&
          paymentMethod === 'cash' &&
          !!received.trim() &&
          (!!receivedError || changeMinor === null || changeMinor < 0n))))
  );

  const quickAmounts = useMemo(
    () => quickCashAmounts(safe ? payableMinor : 0n),
    [safe, payableMinor],
  );
  const isCatalogOpen = query.trim().length > 0 || Boolean(category);

  return (
    <div className="pos-page">
      <header className="pos-header">
        <div className="pos-title">
          {shopName && <span className="pos-shop-badge">{shopName}</span>}
          <div className="pos-title-row">
            <h1>Касса</h1>
            <p className="muted">Продажа товаров</p>
          </div>
        </div>
        <div className="pos-header-actions">
          {!shift.loading && (
            <button
              type="button"
              className={
                active ? 'pos-shift-pill ok' : 'pos-shift-pill warning'
              }
              disabled={!!shift.current && !active}
              onClick={() => setShiftModalOpen(true)}
            >
              {active ? (
                <span className="pos-dot" aria-hidden="true" />
              ) : (
                <Icon name="clock" />
              )}
              <span>
                {active
                  ? 'Завершить смену'
                  : shift.current
                    ? 'Касса занята'
                    : 'Открыть смену'}
              </span>
            </button>
          )}
          <button
            type="button"
            className="button secondary pos-new-receipt-btn"
            disabled={scanDisabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={startNewReceipt}
          >
            <Icon name="receipt" />
            <span>Новый чек</span>
          </button>
        </div>
      </header>

      {shift.error && (
        <p role="alert" className="error">
          {shift.error}
        </p>
      )}

      <div className="pos-layout">
        <section
          className={`pos-panel pos-catalog${isCatalogOpen ? ' catalog-open' : ''}`}
          aria-label="Каталог для кассы"
        >
          <div className="pos-catalog-head">
            <h2 className="pos-panel-title">Поиск товара</h2>
          </div>

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
                onFocus={() => setScannerFocused(true)}
                onBlur={() => setScannerFocused(false)}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    scanOrSearch(event.currentTarget.value);
                  }
                }}
                placeholder="Штрихкод, артикул или название"
              />
            </label>
            <button
              type="button"
              className={`pos-tool pos-tool-scanner${scannerFocused ? ' active' : ''}`}
              aria-label="Фокус для сканера"
              title="USB-сканер держит фокус для ввода штрихкодов"
              disabled={scanDisabled}
              onMouseDown={(e) => {
                e.preventDefault();
                scanInput.current?.focus({ preventScroll: true });
              }}
              onClick={() => {
                scanInput.current?.focus({ preventScroll: true });
                setScannerFocused(true);
              }}
            >
              <Icon name="barcode" />
              <span>Сканер</span>
              <span
                className={`pos-focus-dot${scannerFocused ? ' on' : ''}`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className={`pos-tool${showCost ? ' active' : ''}`}
              aria-label={
                showCost ? 'Скрыть себестоимость' : 'Показать себестоимость'
              }
              title="Показать / скрыть закупочную цену товаров"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowCost((open) => !open)}
            >
              <Icon name="eye" />
              <span>Закупка</span>
            </button>
            <button
              type="button"
              className="pos-tool"
              aria-label="Сканировать камерой"
              disabled={scanDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCamera((open) => !open)}
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCategory(chip.value);
                  scanInput.current?.focus({ preventScroll: true });
                }}
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    void doc.addVariant(product);
                    if (query) setQuery('');
                    scanInput.current?.focus({ preventScroll: true });
                  }}
                >
                  <ProductPhoto product={product} qty={qty} />
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
                    {showCost && (
                      <small className="pos-card-cost" title="Закупочная цена">
                        Закуп:{' '}
                        {product.lastPurchaseMinor !== undefined
                          ? formatSom(product.lastPurchaseMinor)
                          : '—'}
                      </small>
                    )}
                  </span>
                  <span className="pos-product-foot">
                    <span className="pos-product-price">
                      {formatSom(product.salePriceMinor)}
                    </span>
                    <span className="pos-product-add" aria-hidden="true">
                      <svg
                        viewBox="0 0 16 16"
                        width="14"
                        height="14"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z" />
                      </svg>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="pos-side">
          {/* DESKTOP PAYMENT: same controls, icons, buyer and bonus flows as mobile.
              The complete workspace uses internal scroll regions, not page scroll. */}
          <aside
            className="pos-panel pos-payment pos-desktop-payment"
            aria-label="Оплата"
          >
            <PaymentBottomSheet
              embedded
              open={!paymentSheetOpen}
              onClose={() => undefined}
              method={paymentMethod}
              setMethod={setMethod}
              shopId={shopId}
              creditMode={creditSalesEnabled && creditMode}
              setCreditMode={
                creditSalesEnabled ? setCreditMode : () => undefined
              }
              creditCustomerId={creditCustomerId}
              setCreditCustomerId={setCreditCustomerId}
              setCreditCustomerEligible={setCreditCustomerEligible}
              creditPaidText={creditPaidText}
              setCreditPaidText={setCreditPaidText}
              creditDueOn={creditDueOn}
              setCreditDueOn={setCreditDueOn}
              creditDebtMinor={creditDebtMinor}
              loyaltyEnabled={loyaltyEnabled && !creditMode}
              loyaltyToken={loyaltyToken}
              setLoyaltyToken={setLoyaltyToken}
              redeemPoints={redeemPoints}
              setRedeemPoints={setRedeemPoints}
              originalTotalMinor={safe ? Number(afterCheckoutDiscount) : 0}
              checkoutOriginalMinor={totalMinor}
              checkoutDiscountText={checkoutDiscountText}
              setCheckoutDiscountText={setCheckoutDiscountText}
              checkoutDiscountMode={checkoutDiscountMode}
              setCheckoutDiscountMode={setCheckoutDiscountMode}
              checkoutDiscountMinor={checkoutDiscount.minor}
              checkoutDiscountError={checkoutDiscountError}
              received={received}
              setReceived={setReceived}
              totalText={totalText}
              totalMinor={safe ? Number(payableMinor) : 0}
              changeMinor={changeMinor}
              receivedMinor={receivedMinor}
              receivedError={receivedError}
              quickAmounts={quickAmounts}
              canSubmit={canSubmit}
              isSubmitting={doc.busy}
              isSubmissionPending={!!doc.draft.submission}
              onSubmit={() => void submit()}
              error={doc.error}
              success={doc.success}
              onNewReceipt={startNewReceipt}
            />
          </aside>

          {/* CART / RECEIPT WORKSPACE (on mobile, takes full height and scrolls internally) */}
          <section className="pos-panel pos-cart" aria-label="Корзина">
            <div className="pos-cart-head">
              <h2 className="pos-panel-title">
                Чек <span className="pos-count">{itemCount}</span>
              </h2>
              <div className="pos-cart-head-actions">
                <button
                  type="button"
                  className={`pos-cart-cost-btn${showCost ? ' active' : ''}`}
                  title={
                    showCost ? 'Скрыть себестоимость' : 'Показать себестоимость'
                  }
                  aria-label={
                    showCost ? 'Скрыть себестоимость' : 'Показать себестоимость'
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowCost((open) => !open)}
                >
                  <Icon name="eye" />
                  <span>Закупка</span>
                </button>
                {doc.draft.lines.length > 0 && (
                  <button
                    type="button"
                    className="pos-clear"
                    disabled={locked}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void doc.change([]);
                      requestAnimationFrame(() => {
                        scanInput.current?.focus({ preventScroll: true });
                      });
                    }}
                  >
                    <Icon name="trash" />
                    <span>Очистить</span>
                  </button>
                )}
              </div>
            </div>
            <DocumentEditor
              doc={doc}
              receiving={false}
              shopId={shopId}
              cart
              photoFor={(id) => photos.current.get(id)}
              showCost={showCost}
            />
          </section>
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM PAYBAR */}
      <div className="pos-mobile-paybar">
        <div className="pos-mobile-paybar-meta">
          <span className="pos-mobile-paybar-count">
            {doc.draft.lines.length} поз. · {itemCount} ед.
          </span>
          <strong className="pos-mobile-paybar-total">{totalText}</strong>
        </div>
        <button
          type="button"
          className="button primary pos-mobile-pay-btn"
          disabled={locked || !doc.draft.lines.length || !safe}
          onClick={() => setPaymentSheetOpen(true)}
        >
          <Icon name="card" />
          <span>Оплатить — {totalText}</span>
        </button>
      </div>

      {shiftModalOpen && (
        <ShiftQuickModal
          shopId={shopId}
          userId={userId}
          shift={active}
          onClose={() => setShiftModalOpen(false)}
          onCompleted={() => {
            setShiftModalOpen(false);
            setShiftRevision((value) => value + 1);
          }}
        />
      )}

      {/* MOBILE BOTTOM SHEET MODAL */}
      <PaymentBottomSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        method={paymentMethod}
        setMethod={setMethod}
        shopId={shopId}
        creditMode={creditSalesEnabled && creditMode}
        setCreditMode={creditSalesEnabled ? setCreditMode : () => undefined}
        creditCustomerId={creditCustomerId}
        setCreditCustomerId={setCreditCustomerId}
        setCreditCustomerEligible={setCreditCustomerEligible}
        creditPaidText={creditPaidText}
        setCreditPaidText={setCreditPaidText}
        creditDueOn={creditDueOn}
        setCreditDueOn={setCreditDueOn}
        creditDebtMinor={creditDebtMinor}
        loyaltyEnabled={loyaltyEnabled && !creditMode}
        loyaltyToken={loyaltyToken}
        setLoyaltyToken={setLoyaltyToken}
        redeemPoints={redeemPoints}
        setRedeemPoints={setRedeemPoints}
        originalTotalMinor={safe ? Number(afterCheckoutDiscount) : 0}
        checkoutOriginalMinor={totalMinor}
        checkoutDiscountText={checkoutDiscountText}
        setCheckoutDiscountText={setCheckoutDiscountText}
        checkoutDiscountMode={checkoutDiscountMode}
        setCheckoutDiscountMode={setCheckoutDiscountMode}
        checkoutDiscountMinor={checkoutDiscount.minor}
        checkoutDiscountError={checkoutDiscountError}
        received={received}
        setReceived={setReceived}
        totalText={totalText}
        totalMinor={safe ? Number(payableMinor) : 0}
        changeMinor={changeMinor}
        receivedMinor={receivedMinor}
        receivedError={receivedError}
        quickAmounts={quickAmounts}
        canSubmit={canSubmit}
        isSubmitting={doc.busy}
        isSubmissionPending={!!doc.draft.submission}
        onSubmit={() => void submit()}
        error={doc.error}
        success={doc.success}
        onNewReceipt={startNewReceipt}
      />
      {doc.success && lastReceipt && (
        <div className="sale-receipt-print" aria-hidden="true">
          <div style={{ textAlign: 'center', fontWeight: 700 }}>
            {lastReceipt.shopName}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            {new Date(lastReceipt.createdAt).toLocaleString('ru-RU')}
          </div>
          <div className="receipt-divider" />
          {lastReceipt.lines.map((line, idx) => {
            const lineTotal =
              line.quantity * (line.unitPriceMinor - line.discountMinor);
            return (
              <div key={idx} style={{ marginBottom: '4px' }}>
                <div>
                  {idx + 1}. {line.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    {line.quantity} ×{' '}
                    {formatSom(line.unitPriceMinor - line.discountMinor)}
                  </span>
                  <span>{formatSom(lineTotal)}</span>
                </div>
              </div>
            );
          })}
          <div className="receipt-divider" />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
            }}
          >
            <span>ИТОГО:</span>
            <span>{formatSom(lastReceipt.totalMinor)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Оплата:</span>
            <span>
              {lastReceipt.method === 'card' ? 'Безналичные / QR' : 'Наличные'}
            </span>
          </div>
          <div className="receipt-divider" />
          <div style={{ textAlign: 'center' }}>Спасибо за покупку!</div>
        </div>
      )}
    </div>
  );
}

export default function SalePage() {
  const { shopId } = useParams(),
    session = useSession();
  const shop = session.user?.shops?.find((s) => s.id === shopId);
  return (
    <SaleWorkspace
      key={shopId + session.user!.userId}
      shopId={shopId!}
      shopName={shop?.name}
      userId={session.user!.userId}
    />
  );
}
