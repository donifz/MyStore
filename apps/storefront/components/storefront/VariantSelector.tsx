import Link from 'next/link';
import { ProductVariant, formatSom } from '../../lib/public-api';

type Props = {
  currentId: string;
  storeSlug: string;
  variants?: ProductVariant[];
};

export default function VariantSelector({
  currentId,
  storeSlug,
  variants,
}: Props) {
  if (!variants || variants.length <= 1) return null;

  return (
    <section className="sf-variant-selector" aria-label="Разновидности товара">
      <h3 className="sf-variant-title">Выберите вариант ({variants.length})</h3>
      <div className="sf-variant-chips" role="list">
        {variants.map((v) => {
          const isSelected = v.id === currentId;
          const label = [v.size, v.color].filter(Boolean).join(' / ') || v.name;
          const isOutOfStock = v.available <= 0;

          return (
            <Link
              key={v.id}
              href={`/shops/${storeSlug}/products/${v.id}`}
              className={`sf-variant-chip ${isSelected ? 'selected' : ''} ${
                isOutOfStock ? 'out-of-stock' : ''
              }`}
              aria-current={isSelected ? 'true' : undefined}
              role="listitem"
            >
              <div className="sf-variant-chip-body">
                <span className="sf-variant-name">{label}</span>
                <span className="sf-variant-meta">
                  <span className="sf-variant-price">
                    {formatSom(v.salePriceMinor)}
                  </span>
                  {isOutOfStock ? (
                    <span className="sf-variant-stock out">Закончился</span>
                  ) : (
                    <span className="sf-variant-stock in">
                      {v.available} шт.
                    </span>
                  )}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
