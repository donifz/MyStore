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
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

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

  const shop = session.user?.shops.find((s) => s.id === shopId);
  const owner = hasShopPermission(shop, 'return');

  const printReceipt = () => {
    window.print();
  };

  return (
    <>
      <Link className="back-link no-print" to={`/seller/${shopId}/sales`}>
        ← Продажи
      </Link>
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">Касса магазина</p>
          <h1>Продажа</h1>
        </div>
        {sale && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowReceiptPreview(!showReceiptPreview)}
              aria-expanded={showReceiptPreview}
            >
              {showReceiptPreview ? 'Скрыть чек' : 'Предпросмотр чека'}
            </button>
            <button type="button" className="primary" onClick={printReceipt}>
              Печать чека
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="error no-print" role="alert">
          {error}
        </p>
      )}

      {sale && (
        <>
          <section className="panel no-print sale-detail-panel">
            <div className="sale-detail-summary">
              <div>
                <div className="sale-detail-summary__meta">
                  <span className="code" title={sale.id}>
                    Чек #{sale.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(sale.createdAt)}</span>
                </div>
              </div>
              <span
                className={`admin-kit-status ${
                  sale.method === 'cash'
                    ? 'green'
                    : sale.method === 'card'
                      ? 'blue'
                      : 'neutral'
                }`}
              >
                {sale.method === 'cash'
                  ? 'Наличные'
                  : sale.method === 'card'
                    ? 'Карта'
                    : 'Без записи оплаты'}
              </span>
            </div>

            <div className="sale-detail-lines">
              {sale.lines.map((line) => (
                <div className="line-card sale-detail-line" key={line.id}>
                  <div className="line-name">
                    <strong>{line.name}</strong>
                    <div className="sale-detail-line__sub">
                      <small className="code">{line.barcode}</small>
                      <small className="muted">
                        Продано {line.quantity}, возвращено{' '}
                        {line.returnedQuantity}
                      </small>
                    </div>
                  </div>
                  <div className="sale-detail-line__price">
                    <strong>{formatSom(line.unitPriceMinor)}</strong>
                    <small className="muted">за шт.</small>
                    {!!line.discountMinor && (
                      <small className="sale-detail-line__discount">
                        Скидка: {formatSom(line.discountMinor)}
                        {line.discountReason ? ` (${line.discountReason})` : ''}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="sale-detail-total-row">
              <span className="muted">Итого по чеку</span>
              <p className="total">{formatSom(sale.totalMinor)}</p>
            </div>

            <div className="actions sale-detail-actions">
              <button
                type="button"
                className="secondary"
                onClick={printReceipt}
              >
                Печать чека
              </button>
              {owner && (
                <Link
                  className="button primary"
                  to={`/seller/${shopId}/sales/${saleId}/return`}
                >
                  Оформить возврат
                </Link>
              )}
            </div>
          </section>

          {showReceiptPreview && (
            <div className="panel no-print" style={{ marginTop: '1rem' }}>
              <h2>Предпросмотр товарного чека</h2>
              <p className="muted" style={{ marginBottom: '1rem' }}>
                Формат чека для кассовой термоленты (58 / 80 мм) или
                стандартного принтера.
              </p>
              <details
                className="hardware-guide"
                style={{ marginBottom: '1rem' }}
              >
                <summary>Памятка по печати на чековом термопринтере</summary>
                <div className="hardware-guide-body">
                  <p>
                    В окне печати браузера выберите чековый принтер (ширина
                    ленты <code>58 мм</code> или <code>80 мм</code>), поля —{' '}
                    <code>Нет / Минимальные</code>, масштаб — <code>100%</code>{' '}
                    и снимите галочку «Колонтитулы».
                  </p>
                </div>
              </details>
              <div className="sale-receipt-preview">
                <ReceiptContent sale={sale} shopName={shop?.name} />
              </div>
            </div>
          )}

          {/* Printable receipt rendered only during window.print() */}
          <div className="sale-receipt-print" aria-hidden="true">
            <ReceiptContent sale={sale} shopName={shop?.name} />
          </div>
        </>
      )}
    </>
  );
}

function ReceiptContent({
  sale,
  shopName,
}: {
  sale: SaleDetail;
  shopName?: string;
}) {
  return (
    <div className="receipt-box">
      <div className="receipt-header" style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700 }}>
          {shopName || 'Магазин'}
        </h3>
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          ТОВАРНЫЙ ЧЕК
        </div>
        <div
          className="receipt-code"
          style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}
        >
          № {sale.id}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#475569' }}>
          {new Date(sale.createdAt).toLocaleString('ru-RU')}
        </div>
      </div>

      <div
        className="receipt-divider"
        style={{ borderTop: '1px dashed #94a3b8', margin: '8px 0' }}
      />

      <div className="receipt-items">
        {sale.lines.map((line, idx) => {
          const lineTotal =
            line.quantity * line.unitPriceMinor - (line.discountMinor || 0);
          return (
            <div
              key={line.id}
              style={{ marginBottom: '6px', fontSize: '0.85rem' }}
            >
              <div style={{ fontWeight: 600 }}>
                {idx + 1}. {line.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Код: {line.barcode}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span>
                  {line.quantity} × {formatSom(line.unitPriceMinor)}
                </span>
                <span style={{ fontWeight: 600 }}>{formatSom(lineTotal)}</span>
              </div>
              {!!line.discountMinor && (
                <div style={{ fontSize: '0.8rem', color: '#007659' }}>
                  Скидка: -{formatSom(line.discountMinor)}
                  {line.discountReason ? ` (${line.discountReason})` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="receipt-divider"
        style={{ borderTop: '1px dashed #94a3b8', margin: '8px 0' }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontWeight: 700,
          fontSize: '1rem',
        }}
      >
        <span>ИТОГО К ОПЛАТЕ:</span>
        <span>{formatSom(sale.totalMinor)}</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          marginTop: '4px',
        }}
      >
        <span>Оплата:</span>
        <span>
          {sale.method === 'cash'
            ? 'Наличные'
            : sale.method === 'card'
              ? 'Банковская карта'
              : 'Без записи оплаты'}
        </span>
      </div>

      <div
        className="receipt-divider"
        style={{ borderTop: '1px dashed #94a3b8', margin: '8px 0' }}
      />

      <div
        style={{
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#64748b',
          marginTop: '6px',
        }}
      >
        <div>Спасибо за покупку!</div>
        <div style={{ marginTop: '2px' }}>Не является фискальным чеком</div>
      </div>
    </div>
  );
}
