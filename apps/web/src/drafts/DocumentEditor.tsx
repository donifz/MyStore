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
          onClick={doc.beginProductCreation}
        >
          Создать товар с этим штрихкодом
        </button>
      )}
      {receiving && doc.productCreation && (
        <ReceivingProductForm
          key={doc.productCreation}
          shopId={shopId}
          barcode={doc.productCreation}
          disabled={
            doc.blocked || !doc.online || doc.busy || !!doc.draft.submission
          }
          onCancel={doc.closeProductCreation}
          onCreated={async (variant) => {
            const added = await doc.addVariant(variant);
            if (added) doc.closeProductCreation();
            return added;
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
            {!receiving && <small>{formatSom(l.priceMinor)}</small>}
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
