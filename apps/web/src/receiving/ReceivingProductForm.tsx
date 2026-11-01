import { useState } from 'react';
import { validateNewReceivingItem } from './receiving-validation';
import type { Variant } from '../api/types';
import ProductForm from '../catalog/ProductForm';
export default function ReceivingProductForm({
  shopId,
  barcode,
  parentId,
  creationKey,
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
  function validateCurrentItem() {
    validateNewReceivingItem(quantity, unitCostText);
  }
  return (
    <ProductForm
      shopId={shopId}
      parentId={parentId}
      validateBeforeSave={validateCurrentItem}
      validateDraftSave={validateCurrentItem}
      initialBarcode={barcode === '__new__' ? '' : barcode}
      creationKey={creationKey}
      purchaseCostText={unitCostText}
      barcodeReadOnly={barcode !== '__new__'}
      disabled={disabled}
      formLabel="Новый товар в приёмке"
      title="Новый товар в приёмке"
      submitLabel="Добавить в приёмку"
      savedLabel="Добавить в приёмку"
      showCancelInFooter={false}
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
        <div className="product-form-fields receiving-form-fields">
          <label className="product-field-cost">
            <span>Закупочная цена, сом</span>
            <input
              inputMode="decimal"
              value={unitCostText}
              onChange={(e) => setUnitCostText(e.target.value)}
              placeholder="0,00"
            />
          </label>
          <div className="product-field-quantity">
            <label htmlFor="receiving-form-quantity">
              Количество первичной приёмки
            </label>
            <div className="pos-stepper product-form-stepper">
              <button
                type="button"
                aria-label="Уменьшить количество нового товара"
                disabled={Number(quantity) <= 1}
                onClick={() =>
                  setQuantity((q) =>
                    Math.max(1, (Number(q) || 1) - 1).toString(),
                  )
                }
              >
                −
              </button>
              <input
                id="receiving-form-quantity"
                type="number"
                min={1}
                max={1e9}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <button
                type="button"
                aria-label="Увеличить количество нового товара"
                onClick={() =>
                  setQuantity((q) => ((Number(q) || 0) + 1).toString())
                }
              >
                +
              </button>
            </div>
          </div>
        </div>
      }
      onCancel={onCancel}
      onSaved={(variant) => {
        if (onAddedToDraft) {
          return onAddedToDraft(variant, Number(quantity), unitCostText);
        }
        return onCreated(variant, Number(quantity), unitCostText);
      }}
    />
  );
}
