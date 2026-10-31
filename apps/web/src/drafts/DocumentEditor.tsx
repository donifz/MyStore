import { useEffect, useState } from 'react';
import BarcodeLabel from '../catalog/BarcodeLabel';
import ReceivingProductForm from '../receiving/ReceivingProductForm';
import { api } from '../api/client';
import { formatSom, parseSom } from '../api/money';
import type { Page, Variant } from '../api/types';
import { useDocument } from './use-document';
import ScanField from '../scanner/ScanField';
import { isPurchaseAboveSale } from '../receiving/purchase-warning';
import type { DraftLine } from './draft-store';

function lineTotal(quantity: number, unitMinor: number) {
  const total = BigInt(quantity) * BigInt(unitMinor);
  return total <= BigInt(Number.MAX_SAFE_INTEGER)
    ? formatSom(Number(total))
    : 'Сумма превышена';
}

function lineCostTotal(quantity: number, unitCostText?: string) {
  if (!unitCostText?.trim()) return formatSom(0);
  try {
    return lineTotal(quantity, parseSom(unitCostText));
  } catch {
    return '—';
  }
}

function formatPriceInput(minor: number) {
  return new Intl.NumberFormat('ru-KG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(minor / 100)
    .replace(/\u00a0/g, ' ');
}

function Thumb({ photo, className }: { photo?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  return (
    <span className={className} aria-hidden="true">
      {photo && !failed ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      )}
    </span>
  );
}

export default function DocumentEditor({
  doc,
  receiving,
  shopId,
  receivingMetadata,
  parentId,
  cart = false,
  photoFor,
}: {
  doc: ReturnType<typeof useDocument>;
  receiving: boolean;
  shopId: string;
  parentId?: string;
  receivingMetadata?: {
    documentNumber?: string;
    supplier: string;
    receivedOn: string;
    comment: string;
  };
  /** Compact cashier cart: scanner lives in the catalogue search, lines use steppers. */
  cart?: boolean;
  photoFor?: (variantId: string) => string | undefined;
}) {
  const lineDisabled = doc.busy || doc.blocked || !!doc.draft.submission;
  const disabled = lineDisabled || !!doc.productCreation;
  const [discountOpen, setDiscountOpen] = useState<Record<string, boolean>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualItems, setManualItems] = useState<Variant[]>([]);
  useEffect(() => {
    if (!manualOpen || !receiving) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void api<Page<Variant>>(
        `/shops/${shopId}/variants?q=${encodeURIComponent(manualQuery)}&page=1&pageSize=12`,
      )
        .then((page) => {
          if (alive)
            setManualItems(page.items.filter((item) => !item.archived));
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [manualOpen, manualQuery, receiving, shopId]);
  function setQuantity(line: DraftLine, n: number) {
    if (Number.isInteger(n) && n >= 1 && n <= 1e9)
      void doc.change((lines) =>
        lines.map((x) => (x.id === line.id ? { ...x, quantity: n } : x)),
      );
  }
  const resolvePhoto = (id: string) => photoFor?.(id) ?? doc.photoFor?.(id);
  if (cart && !receiving)
    return (
      <div className="pos-cart-body">
        {doc.blocked && (
          <button type="button" onClick={doc.reload}>
            Обновить черновик
          </button>
        )}
        {doc.draft.submission && (
          <p className="notice">
            Результат операции ещё не подтверждён. Состав зафиксирован.
            Повторите исходный запрос.
          </p>
        )}
        {!doc.online && (
          <p className="notice">
            Нет сети. Черновик сохранён, проведение недоступно.
          </p>
        )}
        {doc.error && (
          <p role="alert" className="error">
            {doc.error}
          </p>
        )}
        {doc.priceChange && (
          <button type="button" onClick={doc.acceptPrice}>
            Подтвердить цену {formatSom(doc.priceChange.price)}
          </button>
        )}
        {doc.success && (
          <p role="status" className="success">
            {doc.success}
          </p>
        )}
        {!doc.draft.lines.length && (
          <p className="pos-cart-empty">
            Корзина пуста. Отсканируйте штрихкод или выберите товар в каталоге.
          </p>
        )}
        {doc.draft.lines.map((l) => {
          const unit = l.priceMinor - (l.discountMinor || 0);
          const photo = resolvePhoto(l.id);
          const showDiscount = discountOpen[l.id] || !!l.discountMinor;
          return (
            <div className="pos-cart-line" key={l.id}>
              <Thumb photo={photo} className="pos-cart-thumb" />
              <div className="pos-cart-name">
                <strong>{l.name}</strong>
                <small>
                  {l.discountMinor ? (
                    <>
                      <s>{formatSom(l.priceMinor)}</s> {formatSom(unit)} / шт.
                    </>
                  ) : (
                    <>
                      Арт. {l.barcode} · {formatSom(unit)}
                    </>
                  )}
                </small>
                <button
                  type="button"
                  className="pos-link-button"
                  aria-label={'Скидка ' + l.name}
                  aria-expanded={showDiscount}
                  disabled={disabled}
                  onClick={() =>
                    setDiscountOpen((open) => ({
                      ...open,
                      [l.id]: !open[l.id],
                    }))
                  }
                >
                  {l.discountMinor ? 'Скидка применена' : 'Скидка'}
                </button>
              </div>
              <div className="pos-stepper">
                <button
                  type="button"
                  aria-label={'Уменьшить ' + l.name}
                  disabled={lineDisabled || l.quantity <= 1}
                  onClick={() => setQuantity(l, l.quantity - 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label={'Количество ' + l.name}
                  min={1}
                  max={1e9}
                  value={l.quantity}
                  disabled={lineDisabled}
                  onChange={(e) => setQuantity(l, Number(e.target.value))}
                />
                <button
                  type="button"
                  aria-label={'Увеличить ' + l.name}
                  disabled={lineDisabled || l.quantity >= 1e9}
                  onClick={() => setQuantity(l, l.quantity + 1)}
                >
                  +
                </button>
              </div>
              <strong className="pos-cart-sum">
                {lineTotal(l.quantity, unit)}
              </strong>
              <button
                type="button"
                className="pos-cart-remove"
                aria-label={'Удалить ' + l.name}
                disabled={lineDisabled}
                onClick={() =>
                  doc.change((lines) => lines.filter((x) => x.id !== l.id))
                }
              >
                ×
              </button>
              {showDiscount && (
                <div className="pos-cart-discount">
                  <label>
                    Скидка на шт., сом
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={l.priceMinor / 100}
                      placeholder="0"
                      value={
                        l.discountMinor
                          ? (l.discountMinor / 100).toString()
                          : ''
                      }
                      disabled={disabled}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const num = parseFloat(val);
                        const minorVal =
                          val === '' || isNaN(num) ? 0 : Math.round(num * 100);
                        if (
                          minorVal >= 0 &&
                          minorVal <= l.priceMinor &&
                          Number.isSafeInteger(minorVal)
                        )
                          void doc.change((lines) =>
                            lines.map((x) =>
                              x.id === l.id
                                ? {
                                    ...x,
                                    discountMinor:
                                      minorVal > 0 ? minorVal : undefined,
                                    discountReason:
                                      minorVal > 0
                                        ? x.discountReason
                                        : undefined,
                                  }
                                : x,
                            ),
                          );
                      }}
                    />
                  </label>
                  {!!l.discountMinor && (
                    <label>
                      Причина скидки
                      <input
                        type="text"
                        maxLength={255}
                        placeholder="Причина (обязательно при скидке)"
                        value={l.discountReason ?? ''}
                        disabled={disabled}
                        onChange={(e) => {
                          const reason = e.target.value;
                          void doc.change((lines) =>
                            lines.map((x) =>
                              x.id === l.id
                                ? { ...x, discountReason: reason }
                                : x,
                            ),
                          );
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  return (
    <section className={receiving ? 'panel receiving-editor-panel' : 'panel'}>
      <ScanField
        onScan={doc.scan}
        disabled={disabled}
        onManualAdd={
          receiving ? () => setManualOpen((open) => !open) : undefined
        }
      />
      {receiving && (
        <div className="receiving-quick-actions">
          <button
            type="button"
            className="button primary receiving-quick-new-btn"
            disabled={disabled}
            onClick={() => void doc.beginProductCreation('')}
          >
            <span aria-hidden="true">✨</span>
            <span>Новый товар</span>
          </button>
          <button
            type="button"
            className="button secondary receiving-quick-scan-btn"
            disabled={disabled}
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>(
                '.scan-field-input input',
              );
              el?.focus();
            }}
          >
            <svg
              className="pos-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
            </svg>
            <span>Сканировать</span>
          </button>
        </div>
      )}
      {receiving && manualOpen && !disabled && (
        <div className="receiving-manual-picker">
          <div className="receiving-manual-picker-head">
            <input
              type="search"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              placeholder="Найти существующий товар по названию или штрихкоду"
              aria-label="Поиск товара для приёмки"
            />
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setManualOpen(false);
                void doc.beginProductCreation('');
              }}
            >
              Новый товар
            </button>
          </div>
          {manualItems.length > 0 && (
            <div className="receiving-manual-picker-list">
              {manualItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="receiving-manual-item"
                  onClick={() => {
                    void doc.addVariant(item);
                    setManualOpen(false);
                  }}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.barcode}</small>
                  </span>
                  <span>{formatSom(item.salePriceMinor)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {doc.blocked && <button onClick={doc.reload}>Обновить черновик</button>}
      {doc.draft.submission && (
        <p className="notice">
          Результат операции ещё не подтверждён. Состав зафиксирован. Повторите
          исходный запрос.
        </p>
      )}
      {!doc.online && (
        <p className="notice">
          Нет сети. Черновик сохранён, проведение недоступно.
        </p>
      )}
      {doc.error && (
        <p role="alert" className="error">
          {doc.error}
        </p>
      )}
      {receiving && doc.unknownBarcode && !doc.productCreation && (
        <div role="status" className="notice unknown-barcode-banner">
          <div>
            <strong>Новый штрихкод: {doc.unknownBarcode}</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontWeight: 400 }}>
              Такого товара ещё нет в каталоге магазина. Вы можете сразу создать
              карточку и оприходовать первую партию.
            </p>
          </div>
          <button
            type="button"
            className="button primary"
            disabled={disabled || !doc.online}
            onClick={() => void doc.beginProductCreation()}
          >
            Создать товар с этим штрихкодом
          </button>
        </div>
      )}
      {receiving && doc.productCreation && (
        <div
          className="pos-sheet-root receiving-product-sheet-root"
          role="dialog"
          aria-modal="true"
          aria-label="Новый товар"
        >
          <div
            className="pos-sheet-backdrop"
            aria-hidden="true"
            onClick={doc.closeProductCreation}
          />
          <div className="pos-sheet-drawer receiving-product-sheet-drawer">
            <div className="pos-sheet-handle" aria-hidden="true" />
            <ReceivingProductForm
              key={doc.productCreation}
              shopId={shopId}
              parentId={parentId}
              barcode={doc.productCreation}
              creationKey={doc.draft.primaryReceiving?.productKey}
              draftLines={doc.draft.lines}
              disabled={doc.blocked || !doc.online || doc.busy}
              onCancel={doc.closeProductCreation}
              onSwitchToSearch={() => {
                doc.closeProductCreation();
                setManualOpen(true);
              }}
              onAddedToDraft={(variant, quantity, unitCostText) =>
                doc.addCreatedVariantToDraft(variant, quantity, unitCostText)
              }
              onCreated={(variant, quantity, unitCostText) =>
                doc.receiveCreatedVariant(
                  variant,
                  quantity,
                  unitCostText,
                  receivingMetadata ?? {
                    supplier: '',
                    receivedOn: new Date().toISOString().slice(0, 10),
                    comment: '',
                  },
                )
              }
              onCreatedWithoutReceiving={async () =>
                doc.finishProductCreationWithoutReceiving()
              }
            />
          </div>
        </div>
      )}
      {doc.priceChange && (
        <button type="button" onClick={doc.acceptPrice}>
          Подтвердить цену {formatSom(doc.priceChange.price)}
        </button>
      )}
      {doc.success && (
        <p role="status" className="success">
          {doc.success}
        </p>
      )}
      {receiving && doc.success && doc.lastCreatedVariant && (
        <div className="barcode-print-container">
          <h2>Этикетка созданного товара</h2>
          <BarcodeLabel product={doc.lastCreatedVariant} />
        </div>
      )}
      {!doc.draft.lines.length && (
        <p className="empty-state">
          Отсканируйте первый товар или введите его код
        </p>
      )}
      {receiving && doc.draft.lines.length > 0 && (
        <div className="receiving-lines-section">
          <div className="receiving-lines-toolbar">
            <div className="receiving-lines-title">
              <h3>Товары в приёмке</h3>
              <span className="receiving-lines-badge">
                {doc.draft.lines.length}
              </span>
            </div>
            <button
              type="button"
              className="receiving-clear-btn"
              disabled={lineDisabled}
              onClick={() => void doc.change([])}
            >
              Очистить
            </button>
          </div>
          <div className="receiving-lines-table">
            <div className="receiving-lines-head" aria-hidden="true">
              <span>Товар</span>
              <span>Артикул</span>
              <span>Количество</span>
              <span>Закупочная цена</span>
              <span>Цена продажи</span>
              <span>Сумма</span>
              <span />
            </div>
            {doc.draft.lines.map((l) => (
              <div className="receiving-line-row line-card" key={l.id}>
                <div className="receiving-cell-product">
                  <Thumb
                    photo={resolvePhoto(l.id)}
                    className="receiving-thumb"
                  />
                  <div className="receiving-product-meta">
                    <strong>{l.name}</strong>
                    <span className="receiving-status-pill existing">
                      Существующий товар
                    </span>
                  </div>
                </div>
                <div className="receiving-cell-sku">
                  <small className="code">{l.barcode}</small>
                </div>
                <div className="receiving-cell-qty">
                  <div className="pos-stepper receiving-stepper">
                    <button
                      type="button"
                      aria-label={'Уменьшить ' + l.name}
                      disabled={lineDisabled || l.quantity <= 1}
                      onClick={() => setQuantity(l, l.quantity - 1)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      aria-label={'Количество ' + l.name}
                      min={1}
                      max={1e9}
                      value={l.quantity}
                      disabled={lineDisabled}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1 && n <= 1e9)
                          setQuantity(l, n);
                      }}
                    />
                    <button
                      type="button"
                      aria-label={'Увеличить ' + l.name}
                      disabled={lineDisabled || l.quantity >= 1e9}
                      onClick={() => setQuantity(l, l.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="receiving-unit">шт.</span>
                </div>
                <div className="receiving-cell-cost">
                  <input
                    inputMode="decimal"
                    aria-label={'Закупочная цена ' + l.name + ', сом'}
                    placeholder="0,00"
                    value={l.unitCostText ?? ''}
                    disabled={lineDisabled}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      void doc.change((lines) =>
                        lines.map((x) =>
                          x.id === l.id ? { ...x, unitCostText: value } : x,
                        ),
                      );
                    }}
                  />
                  <span className="receiving-unit">сом</span>
                </div>
                <div className="receiving-cell-sale">
                  <input
                    readOnly
                    tabIndex={-1}
                    aria-label={'Цена продажи ' + l.name + ', сом'}
                    value={formatPriceInput(l.priceMinor)}
                  />
                  <span className="receiving-unit">сом</span>
                </div>
                <div className="receiving-cell-sum">
                  <strong>{lineCostTotal(l.quantity, l.unitCostText)}</strong>
                </div>
                <button
                  type="button"
                  className="receiving-trash-btn"
                  aria-label={'Удалить ' + l.name}
                  disabled={lineDisabled}
                  onClick={() =>
                    doc.change((lines) => lines.filter((x) => x.id !== l.id))
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                  </svg>
                </button>
                {l.lastPurchaseMinor !== undefined && (
                  <div className="receiving-row-extra">
                    <button
                      type="button"
                      className="button secondary receiving-last-purchase-btn"
                      disabled={lineDisabled}
                      onClick={() => {
                        const text = (l.lastPurchaseMinor! / 100).toString();
                        void doc.change((lines) =>
                          lines.map((x) =>
                            x.id === l.id ? { ...x, unitCostText: text } : x,
                          ),
                        );
                      }}
                    >
                      Последняя закупка: {formatSom(l.lastPurchaseMinor)}
                    </button>
                  </div>
                )}
                {isPurchaseAboveSale(l.unitCostText ?? '', l.priceMinor) && (
                  <p role="status" className="notice receiving-row-extra">
                    Закупочная цена за штуку выше цены продажи. Проверьте цены:
                    продажа может быть убыточной.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!receiving &&
        doc.draft.lines.map((l) => (
          <div className="line-card" key={l.id}>
            <div className="line-name">
              <strong>{l.name}</strong>
              <small className="code">{l.barcode}</small>
              <small>
                {l.discountMinor ? (
                  <>
                    <span
                      style={{
                        textDecoration: 'line-through',
                        opacity: 0.6,
                        marginRight: '0.25rem',
                      }}
                    >
                      {formatSom(l.priceMinor)}
                    </span>
                    <strong style={{ color: 'var(--color-primary, #007659)' }}>
                      {formatSom(l.priceMinor - l.discountMinor)}
                    </strong>
                  </>
                ) : (
                  formatSom(l.priceMinor)
                )}
              </small>
            </div>
            <label>
              Количество {l.name}
              <input
                type="number"
                min={1}
                max={1e9}
                value={l.quantity}
                disabled={lineDisabled}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 1e9)
                    setQuantity(l, n);
                }}
              />
            </label>
            <div
              className="line-discount-box"
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginTop: '0.25rem',
              }}
            >
              <label style={{ flex: '1 1 120px' }}>
                Скидка на шт., сом
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={l.priceMinor / 100}
                  placeholder="0"
                  value={
                    l.discountMinor ? (l.discountMinor / 100).toString() : ''
                  }
                  disabled={disabled}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    const num = parseFloat(val);
                    const minorVal =
                      val === '' || isNaN(num) ? 0 : Math.round(num * 100);
                    if (
                      minorVal >= 0 &&
                      minorVal <= l.priceMinor &&
                      Number.isSafeInteger(minorVal)
                    ) {
                      doc.change((lines) =>
                        lines.map((x) =>
                          x.id === l.id
                            ? {
                                ...x,
                                discountMinor:
                                  minorVal > 0 ? minorVal : undefined,
                                discountReason:
                                  minorVal > 0 ? x.discountReason : undefined,
                              }
                            : x,
                        ),
                      );
                    }
                  }}
                />
              </label>
              {!!l.discountMinor && (
                <label style={{ flex: '2 1 180px' }}>
                  Причина скидки
                  <input
                    type="text"
                    maxLength={255}
                    placeholder="Причина (обязательно при скидке)"
                    value={l.discountReason ?? ''}
                    disabled={disabled}
                    onChange={(e) => {
                      const reason = e.target.value;
                      doc.change((lines) =>
                        lines.map((x) =>
                          x.id === l.id ? { ...x, discountReason: reason } : x,
                        ),
                      );
                    }}
                  />
                </label>
              )}
            </div>
            <button
              type="button"
              className="danger"
              aria-label={'Удалить ' + l.name}
              disabled={lineDisabled}
              onClick={() =>
                doc.change((lines) => lines.filter((x) => x.id !== l.id))
              }
            >
              ×
            </button>
          </div>
        ))}
    </section>
  );
}
