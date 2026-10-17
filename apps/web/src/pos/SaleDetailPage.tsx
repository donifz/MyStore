import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { hasShopPermission, type SaleDetail } from '../api/types';
import { formatSom, formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';
export default function SaleDetailPage() {
  const { shopId, saleId } = useParams();
  const session = useSession();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setSale(null);
    setError('');
    api<SaleDetail>(`/shops/${shopId}/pos/sales/${saleId}`)
      .then((data) => {
        if (alive) setSale(data);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [shopId, saleId]);
  const owner = hasShopPermission(
    session.user?.shops.find((shop) => shop.id === shopId),
    'return',
  );
  return (
    <>
      <Link className="back-link" to={`/seller/${shopId}/sales`}>
        ← Продажи
      </Link>
      <h1>Продажа</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sale && (
        <section className="panel">
          <p className="code">{sale.id}</p>
          <p>
            {formatDate(sale.createdAt)} ·{' '}
            {sale.method === 'cash'
              ? 'Наличные'
              : sale.method === 'card'
                ? 'Карта'
                : 'Без записи оплаты'}
          </p>
          {sale.lines.map((line) => (
            <div className="line-card" key={line.id}>
              <div className="line-name">
                <strong>{line.name}</strong>
                <small className="code">{line.barcode}</small>
                <small>
                  Продано {line.quantity}, возвращено {line.returnedQuantity}
                </small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span>{formatSom(line.unitPriceMinor)} за шт.</span>
                {!!line.discountMinor && (
                  <small
                    className="muted"
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: '#007659',
                    }}
                  >
                    Скидка: {formatSom(line.discountMinor)}
                    {line.discountReason ? ` (${line.discountReason})` : ''}
                  </small>
                )}
              </div>
            </div>
          ))}
          <p className="total">{formatSom(sale.totalMinor)}</p>
          {owner && (
            <Link
              className="button"
              to={`/seller/${shopId}/sales/${saleId}/return`}
            >
              Оформить возврат
            </Link>
          )}
        </section>
      )}
    </>
  );
}
