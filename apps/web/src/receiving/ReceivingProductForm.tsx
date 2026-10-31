import { useState } from 'react';
import { parseSom } from '../api/money';
import type { Variant } from '../api/types';
import ProductForm from '../catalog/ProductForm';
export default function ReceivingProductForm({
  shopId,
  barcode,
  parentId,
  creationKey,
  draftLines,
  disabled,
  onCancel,
  onSwitchToSearch,
  onCreated,
  onAddedToDraft,
  onCreatedWithoutReceiving,
}: {
  shopId: string;
  barcode: string;
  parentId?: string;
  creationKey?: string;
  draftLines?: { name: string; quantity: number; unitCostText?: string }[];
  disabled: boolean;
  onCancel: () => void;
  onSwitchToSearch?: () => void;
  onCreated: (
    variant: Variant,
    quantity: number,
    unitCostText: string,
  ) => Promise<boolean>;
  onAddedToDraft?: (
    variant: Variant,
    quantity: number,
    unitCostText: string,
  ) => Promise<boolean>;
  onCreatedWithoutReceiving?: (variant: Variant) => Promise<boolean>;
}) {
  const [quantity, setQuantity] = useState('1');
  const [unitCostText, setUnitCostText] = useState('');
  function validateQuantityAndCost() {
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 1e9)
      throw new Error('Укажите корректное количество (1–1 000 000 000).');
    return { count, unitCostMinor: parseSom(unitCostText) };
  }
  return (
    <ProductForm
      shopId={shopId}
      parentId={parentId}
      validateBeforeSave={() => {
        const { count, unitCostMinor } = validateQuantityAndCost();
        let total = BigInt(count) * BigInt(unitCostMinor);
        for (const line of draftLines ?? []) {
          let lineCost: number;
          try {
            lineCost = parseSom(line.unitCostText ?? '');
          } catch {
            throw new Error(
              `Укажите корректную закупочную цену для «${line.name}».`,
            );
          }
          total += BigInt(line.quantity) * BigInt(lineCost);
        }
        if (total > BigInt(Number.MAX_SAFE_INTEGER))
          throw new Error('Сумма слишком велика.');
      }}
      validateDraftSave={() => {
        validateQuantityAndCost();
      }}
      initialBarcode={barcode === '__new__' ? '' : barcode}
      creationKey={creationKey}
      purchaseCostText={unitCostText}
      barcodeReadOnly={barcode !== '__new__'}
      disabled={disabled}
      formLabel="Новый товар в приёмке"
      title="Новый товар в приёмке"
      submitLabel="Создать и провести приёмку"
      savedLabel="Добавить в приёмку"
      headerActions={
        onSwitchToSearch ? (
          <div className="product-form-mode-tabs">
            <span className="product-form-mode-tab active">
              + Создать товар
            </span>
            <button
              type="button"
              className="product-form-mode-tab"
              disabled={disabled}
              onClick={onSwitchToSearch}
            >
              Найти существующий
            </button>
          </div>
        ) : undefined
      }
      footerFields={
        <div className="product-form-fields">
          <label>
            Закупочная цена, сом
            <input
              inputMode="decimal"
              value={unitCostText}
              onChange={(e) => setUnitCostText(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <label>
            Количество первичной приёмки
            <input
              type="number"
              min={1}
              max={1e9}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        </div>
      }
      {...(onAddedToDraft
        ? { addToDraftLabel: 'Создать и добавить в приёмку' }
        : {})}
      {...(onCreatedWithoutReceiving
        ? { secondarySubmitLabel: 'Создать без приёмки' }
        : {})}
      onCancel={onCancel}
      onSaved={(variant) => onCreated(variant, Number(quantity), unitCostText)}
      onAddToDraft={
        onAddedToDraft
          ? (variant) => onAddedToDraft(variant, Number(quantity), unitCostText)
          : undefined
      }
      onSecondarySaved={onCreatedWithoutReceiving}
    />
  );
}
