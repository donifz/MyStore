import { useState } from 'react';
import BarcodeLabel from '../catalog/BarcodeLabel';
import ReceivingProductForm from '../receiving/ReceivingProductForm';
import { formatSom } from '../api/money';
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
  function setQuantity(line: DraftLine, n: number) {
    if (Number.isInteger(n) && n >= 1 && n <= 1e9)
      void doc.change((lines) =>
        lines.map((x) => (x.id === line.id ? { ...x, quantity: n } : x)),
      );
  }
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
          const photo = photoFor?.(l.id);
          const showDiscount = discountOpen[l.id] || !!l.discountMinor;
          return (
            <div className="pos-cart-line" key={l.id}>
              <span className="pos-cart-thumb" aria-hidden="true">
                {photo ? <img src={photo} alt="" loading="lazy" /> : '▦'}
              </span>
              <div className="pos-cart-name">
                <strong>{l.name}</strong>
                <small>
                  {l.discountMinor ? (
                    <>
                      <s>{formatSom(l.priceMinor)}</s> {formatSom(unit)} / шт.
                    </>
                  ) : (
                    <>Арт. {l.barcode}</>
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
    <section className="panel">
      <ScanField onScan={doc.scan} disabled={disabled} />
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
        <ReceivingProductForm
          key={doc.productCreation}
          shopId={shopId}
          parentId={parentId}
          barcode={doc.productCreation}
          creationKey={doc.draft.primaryReceiving?.productKey}
          draftLines={doc.draft.lines}
          disabled={doc.blocked || !doc.online || doc.busy}
          onCancel={doc.closeProductCreation}
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
      {doc.draft.lines.map((l) => (
        <div className="line-card" key={l.id}>
          <div className="line-name">
            <strong>{l.name}</strong>
            <small className="code">{l.barcode}</small>
            {!receiving && (
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
            )}
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
                  doc.change((lines) =>
                    lines.map((x) =>
                      x.id === l.id ? { ...x, quantity: n } : x,
                    ),
                  );
              }}
            />
          </label>
          {receiving && (
            <>
              <label>
                Закупочная цена {l.name}, сом
                <input
                  inputMode="decimal"
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
              </label>
              {l.lastPurchaseMinor !== undefined && (
                <div className="line-card-full">
                  <button
                    type="button"
                    className="button secondary"
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
                <p role="status" className="notice line-card-full">
                  Закупочная цена за штуку выше цены продажи. Проверьте цены:
                  продажа может быть убыточной.
                </p>
              )}
            </>
          )}
          {!receiving && (
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
          )}
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
