import ReceivingProductForm from '../receiving/ReceivingProductForm';
import { formatSom } from '../api/money';
import { useDocument } from './use-document';
import ScanField from '../scanner/ScanField';
export default function DocumentEditor({
  doc,
  receiving,
  shopId,
}: {
  doc: ReturnType<typeof useDocument>;
  receiving: boolean;
  shopId: string;
}) {
  const disabled =
    doc.busy || doc.blocked || !!doc.draft.submission || !!doc.productCreation;
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
        <button
          type="button"
          className="button"
          disabled={disabled || !doc.online}
          onClick={() => void doc.beginProductCreation()}
        >
          Создать товар с этим штрихкодом
        </button>
      )}
      {receiving && doc.productCreation && (
        <ReceivingProductForm
          key={doc.productCreation}
          shopId={shopId}
          barcode={doc.productCreation}
          creationKey={doc.draft.primaryReceiving?.productKey}
          disabled={
            doc.blocked || !doc.online || doc.busy || !!doc.draft.submission
          }
          onCancel={doc.closeProductCreation}
          onCreated={doc.receiveCreatedVariant}
          onCreatedWithoutReceiving={async () => {
            doc.finishProductCreationWithoutReceiving();
            return true;
          }}
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
              disabled={disabled}
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
            <label>
              Закупочная цена {l.name}, сом
              <input
                inputMode="decimal"
                value={l.unitCostText ?? ''}
                disabled={disabled}
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
            disabled={disabled}
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
