import type { Variant } from '../api/types';
import ProductForm from '../catalog/ProductForm';
export default function ReceivingProductForm({
  shopId,
  barcode,
  disabled,
  onCancel,
  onCreated,
}: {
  shopId: string;
  barcode: string;
  disabled: boolean;
  onCancel: () => void;
  onCreated: (variant: Variant) => Promise<boolean>;
}) {
  return (
    <ProductForm
      shopId={shopId}
      initialBarcode={barcode}
      barcodeReadOnly
      disabled={disabled}
      formLabel="Новый товар в приёмке"
      title="Новый товар в приёмке"
      submitLabel="Создать и добавить в приёмку"
      savedLabel="Добавить в приёмку"
      onCancel={onCancel}
      onSaved={onCreated}
    />
  );
}
