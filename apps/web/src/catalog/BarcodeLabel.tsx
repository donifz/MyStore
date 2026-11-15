import { useState } from 'react';
import { formatSom } from '../api/money';
import { Variant } from '../api/types';
import { code128SvgPath } from './code128';

export type LabelSize = '30x20' | '58x40';

export function normalizeLabelCopies(value: number | string): number {
  return Math.max(1, Math.min(100, Number(value) || 1));
}

export function LabelPrintPage({ size }: { size: LabelSize }) {
  const paperSize = size === '30x20' ? '30mm 20mm' : '58mm 40mm';
  return (
    <style>
      {'@media print { @page { size: ' + paperSize + '; margin: 0; } }'}
    </style>
  );
}

export function isSmallLabelBarcodeDense(value: string) {
  try {
    return code128SvgPath(value).width > 170;
  } catch {
    return false;
  }
}

export default function BarcodeLabel({
  product,
  copies = 1,
  hidePrintButton = false,
  size,
}: {
  product: Pick<
    Variant,
    'id' | 'name' | 'barcode' | 'salePriceMinor' | 'sku' | 'shortBarcode'
  >;
  copies?: number;
  hidePrintButton?: boolean;
  size?: LabelSize;
}) {
  const [copyCount, setCopyCount] = useState(
    String(normalizeLabelCopies(copies)),
  );
  const [localSize, setLocalSize] = useState<LabelSize>('30x20');
  const labelSize = size ?? localSize;
  const numberOfCopies = hidePrintButton
    ? normalizeLabelCopies(copies)
    : normalizeLabelCopies(copyCount);
  const printedBarcode = product.shortBarcode || product.barcode;
  let barcode: { path: string; width: number } | null = null;
  let barcodeError = '';
  try {
    barcode = code128SvgPath(printedBarcode);
  } catch (error) {
    barcodeError =
      error instanceof Error ? error.message : 'Не удалось создать штрихкод';
  }

  return (
    <div className="barcode-preview">
      {!hidePrintButton && <LabelPrintPage size={labelSize} />}
      {Array.from({ length: numberOfCopies }, (_, index) => (
        <div
          className={'barcode-label barcode-label--' + labelSize}
          data-product-id={product.id}
          key={index}
        >
          <strong className="barcode-product-name">{product.name}</strong>
          <strong className="barcode-price">
            {formatSom(product.salePriceMinor)}
          </strong>
          {product.sku && (
            <span className="barcode-sku">Арт.: {product.sku}</span>
          )}
          <div className="barcode-mark">
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
            <span className="barcode-value">{printedBarcode}</span>
          </div>
        </div>
      ))}
      {!hidePrintButton && (
        <div className="barcode-label-actions no-print">
          <label>
            Размер этикетки
            <select
              aria-label="Размер этикетки"
              value={labelSize}
              onChange={(event) =>
                setLocalSize(event.target.value as LabelSize)
              }
            >
              <option value="30x20">30 × 20 мм</option>
              <option value="58x40">58 × 40 мм</option>
            </select>
          </label>
          <label>
            Копии
            <input
              aria-label="Количество копий"
              type="number"
              min={1}
              max={100}
              value={copyCount}
              onChange={(event) => {
                const cleaned = event.target.value
                  .replace(/\D/g, '')
                  .replace(/^0+(?=\d)/, '');
                if (event.target.value !== cleaned)
                  event.currentTarget.value = cleaned;
                setCopyCount(cleaned);
              }}
              onBlur={() =>
                setCopyCount(String(normalizeLabelCopies(copyCount)))
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
      {!hidePrintButton &&
        labelSize === '30x20' &&
        barcode &&
        barcode.width > 170 && (
          <p className="barcode-size-warning no-print">
            Длинный штрихкод может плохо считываться на наклейке 30 × 20 мм.
            Используйте короткий код или этикетку 58 × 40 мм.
          </p>
        )}
    </div>
  );
}
