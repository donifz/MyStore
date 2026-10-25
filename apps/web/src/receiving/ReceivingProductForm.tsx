import type { Variant } from '../api/types';
import ProductForm from '../catalog/ProductForm';
export default function ReceivingProductForm({
  shopId,
  barcode,
  creationKey,
  disabled,
  onCancel,
  onCreated,
  onCreatedWithoutReceiving,
}: {
  shopId: string;
  barcode: string;
  creationKey?: string;
  disabled: boolean;
  onCancel: () => void;
  onCreated: (variant: Variant) => Promise<boolean>;
  onCreatedWithoutReceiving?: (variant: Variant) => Promise<boolean>;
}) {
  return (
    <ProductForm
      shopId={shopId}
      initialBarcode={barcode}
      creationKey={creationKey}
      barcodeReadOnly
      disabled={disabled}
      formLabel="Новый товар в приёмке"
      title="Новый товар в приёмке"
      submitLabel="Создать и добавить в приёмку"
      savedLabel="Добавить в приёмку"
      {...(onCreatedWithoutReceiving
        ? { secondarySubmitLabel: 'Создать без приёмки' }
        : {})}
      onCancel={onCancel}
      onSaved={onCreated}
      onSecondarySaved={onCreatedWithoutReceiving}
    />
  );
}
