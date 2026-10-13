import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import type { Variant } from '../api/types';
import ProductForm from './ProductForm';
import BarcodeLabel from './BarcodeLabel';
function CreateWorkspace({ shopId }: { shopId: string }) {
  const [saved, setSaved] = useState<Variant | null>(null);
  return (
    <>
      <Link className="back-link" to={`/seller/${shopId}/products`}>
        ← Товары
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Каталог магазина</p>
          <h1>Добавить товар</h1>
          <p className="muted">
            Фото, штрихкод и данные товара — в одной форме
          </p>
        </div>
      </div>
      {saved ? (
        <section className="panel form-panel barcode-print-container">
          <p role="status" className="success">
            Товар создан. Остаток не изменён.
          </p>
          <h2>{saved.name}</h2>
          {saved.photoUrl && (
            <img
              className="capture-photo"
              src={saved.photoUrl}
              alt="Сохранённое фото"
            />
          )}
          <p className="notice">
            Карточка отправлена на проверку. На опубликованной витрине товар
            появится после одобрения администратором платформы.
          </p>
          <BarcodeLabel product={saved} />
          <Link to={`/seller/${shopId}/receiving`} className="primary button">
            Перейти к приёмке
          </Link>
        </section>
      ) : (
        <ProductForm shopId={shopId} onSaved={(v) => setSaved(v)} />
      )}
    </>
  );
}
export default function CreateVariantPage() {
  const { shopId } = useParams(),
    session = useSession(),
    shop = session.user?.shops.find((s) => s.id === shopId);
  if (!shop || shop.role === 'cashier')
    return <p role="alert">Недостаточно прав для создания товара.</p>;
  return (
    <CreateWorkspace key={shop.id + session.user!.userId} shopId={shop.id} />
  );
}
