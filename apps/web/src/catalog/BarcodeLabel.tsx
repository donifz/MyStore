import { useState } from 'react';
import { formatSom } from '../api/money';
import { Variant } from '../api/types';
import { code128SvgPath } from './code128';

export default function BarcodeLabel({
  product,
  copies = 1,
  hidePrintButton = false,
}: {
  product: Pick<Variant, 'id' | 'name' | 'barcode' | 'salePriceMinor' | 'sku'>;
  copies?: number;
  hidePrintButton?: boolean;
}) {
  const [copyCount, setCopyCount] = useState(
    Math.max(1, Math.min(100, copies)),
  );
  let barcode: { path: string; width: number } | null = null;
  let barcodeError = '';
  try {
    barcode = code128SvgPath(product.barcode);
  } catch (error) {
    barcodeError =
      error instanceof Error ? error.message : 'Не удалось создать штрихкод';
  }

  return (
    <div className="barcode-preview">
      {Array.from({ length: copyCount }, (_, index) => (
        <div className="barcode-label" data-product-id={product.id} key={index}>
          <strong className="barcode-product-name">{product.name}</strong>
          <strong className="barcode-price">
            {formatSom(product.salePriceMinor)}
          </strong>
          {product.sku && (
            <span className="barcode-sku">Арт.: {product.sku}</span>
          )}
          {barcode ? (
            <svg
              className="barcode-symbol"
              role="img"
              aria-label="Штрихкод"
              viewBox={`0 0 ${barcode.width} 50`}
              preserveAspectRatio="none"
            >
              <path d={barcode.path} />
            </svg>
          ) : (
            <p role="alert" className="error barcode-error">
              {barcodeError}
            </p>
          )}
          <span className="barcode-value">{product.barcode}</span>
        </div>
      ))}
      {!hidePrintButton && (
        <div className="barcode-label-actions no-print">
          <label>
            Копии
            <input
              aria-label="Количество копий"
              type="number"
              min={1}
              max={100}
              value={copyCount}
              onChange={(event) =>
                setCopyCount(
                  Math.max(1, Math.min(100, Number(event.target.value) || 1)),
                )
              }
            />
          </label>
          <button
            type="button"
            className="primary"
            disabled={!barcode}
            onClick={() => window.print()}
          >
            Печать этикетки
          </button>
        </div>
      )}
    </div>
  );
}
