import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { useDocument } from '../drafts/use-document';
import { formatSom } from '../api/money';
import type { Variant } from '../api/types';
import BarcodeLabel from './BarcodeLabel';
function CaptureRecovery({
  shopId,
  userId,
}: {
  shopId: string;
  userId: string;
}) {
  const doc = useDocument({ shopId, userId, kind: 'capture' }),
    [saved, setSaved] = useState<(Variant & { quantity: number }) | null>(null),
    body = doc.draft.submission?.body;
  if (!body && !doc.blocked && !doc.error && !saved)
    return <Navigate to={`/seller/${shopId}/products/new`} replace />;
  return (
    <>
      <h1>Завершение сохранения товара</h1>
      {doc.error && (
        <p role="alert" className="error">
          {doc.error}
        </p>
      )}
      {saved ? (
        <section className="panel">
          <p role="status" className="success">
            Товар создан и принят: {saved.quantity} шт.
          </p>
          <h2>{saved.name}</h2>
          <BarcodeLabel product={saved} />
        </section>
      ) : (
        body && (
          <section className="panel">
            <h2>{body.name}</h2>
            <p>Количество: {body.quantity} шт.</p>
            <p>Закупочная цена: {formatSom(body.unitCostMinor)}</p>
            <p>Цена продажи: {formatSom(body.salePriceMinor)}</p>
            <p className="notice">
              Результат прежней операции не подтверждён. Повтор использует
              исходные данные и не создаёт второй приход.
            </p>
            <button
              className="primary"
              disabled={doc.busy || doc.blocked || !doc.online}
              onClick={() =>
                void doc
                  .send(`/shops/${shopId}/variants/capture`, body)
                  .then((result) => {
                    if (result)
                      setSaved(result as Variant & { quantity: number });
                  })
              }
            >
              {doc.busy ? 'Сохранение…' : 'Повторить сохранение'}
            </button>
          </section>
        )
      )}
      <Link className="button" to={`/seller/${shopId}/products/new`}>
        Добавить товар
      </Link>
    </>
  );
}
export default function CapturePage() {
  const { shopId } = useParams(),
    session = useSession(),
    shop = session.user?.shops.find((s) => s.id === shopId);
  if (!shop || !session.user || shop.role === 'cashier')
    return <p role="alert">Недостаточно прав для создания товара.</p>;
  return (
    <CaptureRecovery
      key={shop.id + session.user.userId}
      shopId={shop.id}
      userId={session.user.userId}
    />
  );
}
