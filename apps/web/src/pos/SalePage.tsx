import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Page, Variant } from '../api/types';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { formatSom, parseSom } from '../api/money';
import { useDocument } from '../drafts/use-document';
import DocumentEditor from '../drafts/DocumentEditor';
import { useCurrentShift } from './use-current-shift';
function ProductThumbnail({ product }: { product: Variant }) {
  const photo = product.photoUrls?.find(Boolean) || product.photoUrl;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  return (
    <span className="cashier-product-glyph">
      {photo && !failed ? (
        <img src={photo} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">▦</span>
      )}
    </span>
  );
}
function SaleWorkspace({ shopId, userId }: { shopId: string; userId: string }) {
  const doc = useDocument({ userId, shopId, kind: 'sale' }),
    [method, setMethod] = useState<'cash' | 'card'>('cash'),
    shift = useCurrentShift(shopId, doc.success),
    [query, setQuery] = useState(''),
    [products, setProducts] = useState<Variant[]>([]),
    [catalogError, setCatalogError] = useState(''),
    [received, setReceived] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    searchRef.current?.focus();
  }, []);
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      void api<Page<Variant>>(
        `/shops/${shopId}/variants?q=${encodeURIComponent(query)}&page=1&pageSize=24`,
      )
        .then((result) => {
          if (alive) {
            setProducts(result.items.filter((item) => !item.archived));
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
  }, [shopId, query, doc.success]);
  useEffect(() => {
    if (doc.success) {
      setReceived('');
      setQuery('');
      searchRef.current?.focus();
    }
  }, [doc.success]);
  const active = shift.current && 'id' in shift.current ? shift.current : null;
  const sum = doc.draft.lines.reduce(
      (n, l) =>
        n + BigInt(l.quantity) * BigInt(l.priceMinor - (l.discountMinor || 0)),
      0n,
    ),
    safe = sum <= BigInt(Number.MAX_SAFE_INTEGER);
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
  return (
    <>
      <div className="page-heading cashier-heading">
        <div>
          <h1>Касса</h1>
          <p className="muted">Продажи в торговой точке</p>
        </div>
        <Link className="button" to={'/seller/' + shopId + '/shift'}>
          {active
            ? 'Моя смена открыта'
            : shift.current
              ? 'Посмотреть смену'
              : 'Открыть смену'}
        </Link>
      </div>
      {shift.error && (
        <p role="alert" className="error">
          {shift.error}
        </p>
      )}
      {!shift.loading && !active && (
        <p className="notice">
          {shift.current
            ? 'Касса занята другим сотрудником.'
            : 'Смена не открыта. Откройте её перед продажей.'}
        </p>
      )}
      <div className="cashier-workspace">
        <section
          className="cashier-catalog panel"
          aria-label="Каталог для кассы"
        >
          <div className="cashier-catalog-heading">
            <div>
              <h2>Поиск товара</h2>
            </div>
          </div>
          <label className="cashier-product-search">
            <span className="visually-hidden">Найти товар</span>
            <input
              type="search"
              ref={searchRef}
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название, артикул или штрихкод"
              aria-label="Поиск товаров для кассы"
            />
          </label>
          {catalogError && (
            <p role="alert" className="error">
              {catalogError}
            </p>
          )}
          {!catalogError && products.length === 0 && (
            <p className="empty-state">
              Товары не найдены. Можно воспользоваться сканером в корзине.
            </p>
          )}
          <div className="cashier-product-grid">
            {products.map((product) => (
              <button
                type="button"
                className="cashier-product-card"
                key={product.id}
                disabled={
                  locked || !doc.online || (product.available ?? 1) <= 0
                }
                onClick={() => void doc.addVariant(product)}
              >
                <ProductThumbnail product={product} />
                <strong>{product.name}</strong>
                <span className="cashier-product-price">
                  {formatSom(product.salePriceMinor)}
                </span>
                <small className="muted">
                  {product.available === undefined
                    ? product.barcode
                    : `Доступно: ${product.available}`}
                </small>
              </button>
            ))}
          </div>
        </section>
        <div className="cashier-checkout">
          <aside className="panel cashier-payment summary-panel">
            <div className="cashier-summary-row cashier-subtotal">
              <span>Сумма товаров</span>
              <strong>
                {safe ? formatSom(Number(sum)) : 'Сумма превышена'}
              </strong>
            </div>
            <div className="cashier-summary-total">
              <span>Итого</span>
              <strong>
                {safe ? formatSom(Number(sum)) : 'Сумма превышена'}
              </strong>
            </div>
            <fieldset className="cashier-payment-methods" disabled={locked}>
              <legend>Способ оплаты</legend>
              <label
                className={
                  paymentMethod === 'cash'
                    ? 'cashier-method selected'
                    : 'cashier-method'
                }
              >
                <input
                  type="radio"
                  name="cashier-method"
                  value="cash"
                  checked={
                    (doc.draft.submission?.body.method ?? method) === 'cash'
                  }
                  onChange={() => setMethod('cash')}
                />
                Наличные
              </label>
              <label
                className={
                  paymentMethod === 'card'
                    ? 'cashier-method selected'
                    : 'cashier-method'
                }
              >
                <input
                  type="radio"
                  name="cashier-method"
                  value="card"
                  checked={
                    (doc.draft.submission?.body.method ?? method) === 'card'
                  }
                  onChange={() => setMethod('card')}
                />
                Банковская карта
              </label>
            </fieldset>
            {paymentMethod === 'cash' && (
              <>
                <label className="cashier-received">
                  Получено от покупателя, сом
                  <input
                    inputMode="decimal"
                    value={received}
                    disabled={locked}
                    placeholder="Например, 4000"
                    onChange={(event) => setReceived(event.target.value)}
                  />
                </label>
                <div className="cashier-quick-cash">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={locked || !safe || sum === 0n}
                    onClick={() => setReceived((Number(sum) / 100).toString())}
                  >
                    Без сдачи
                  </button>
                  {[100, 500, 1000, 5000].map((bill) => (
                    <button
                      type="button"
                      key={bill}
                      className="button secondary"
                      disabled={locked}
                      onClick={() => {
                        const base =
                          receivedMinor !== null && !receivedError
                            ? receivedMinor
                            : 0;
                        const next = base + bill * 100;
                        if (Number.isSafeInteger(next))
                          setReceived((next / 100).toString());
                      }}
                    >
                      +{bill}
                    </button>
                  ))}
                </div>
                {receivedError && (
                  <p role="alert" className="error">
                    {receivedError}
                  </p>
                )}
                {changeMinor !== null && (
                  <div className="cashier-summary-row" role="status">
                    <span>{changeMinor >= 0n ? 'Сдача' : 'Не хватает'}</span>
                    <strong>
                      {formatSom(
                        Number(changeMinor >= 0n ? changeMinor : -changeMinor),
                      )}
                    </strong>
                  </div>
                )}
              </>
            )}
            <p className="muted cashier-payment-hint">
              Проводите продажу только после получения денег. Оплата картой
              отмечается вручную.
            </p>
            <button
              className="primary full-width cashier-submit"
              onClick={() => void submit()}
              disabled={
                doc.busy ||
                doc.blocked ||
                !doc.online ||
                !doc.draft.lines.length ||
                (!doc.draft.submission &&
                  (!active ||
                    !safe ||
                    (paymentMethod === 'cash' &&
                      !!received.trim() &&
                      (!!receivedError ||
                        changeMinor === null ||
                        changeMinor < 0n))))
              }
            >
              {doc.busy
                ? 'Проведение…'
                : doc.draft.submission
                  ? 'Повторить исходный запрос'
                  : 'Провести продажу'}
            </button>
          </aside>
          <section className="panel cashier-cart-panel" aria-label="Корзина">
            <div className="cashier-cart-title">
              <h2>Корзина</h2>
              <span className="badge">
                {doc.draft.lines.reduce((n, l) => n + l.quantity, 0)} шт.
              </span>
            </div>
            <div className="cashier-lines">
              <DocumentEditor doc={doc} receiving={false} shopId={shopId} />
            </div>
          </section>
        </div>
      </div>
    </>
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
