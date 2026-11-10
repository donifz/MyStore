import Link from 'next/link';
import Icon from '../../../components/storefront/Icon';
import Price from '../../../components/storefront/Price';
import ProductPhoto from '../../../components/storefront/ProductPhoto';
import { metadata } from '../../../lib/seo';

export const dynamic = 'force-dynamic';
export const generateMetadata = () =>
  metadata(
    'Статус заказа — MyStore',
    'Отслеживание статуса и состава заказа.',
    '/orders/38472',
    true,
  );

const ORDER_ITEMS = [
  {
    id: '11111111-1111-4111-8111-111111111100',
    name: 'Плюшевый мишка',
    qtyLabel: '1 × 1 290 сом',
    priceMinor: 129000,
    category: 'Мягкие игрушки',
  },
  {
    id: '11111111-1111-4111-8111-111111111107',
    name: 'Машинка на управлении',
    qtyLabel: '1 × 1 990 сом',
    priceMinor: 199000,
    category: 'Машинки',
  },
  {
    id: '11111111-1111-4111-8111-111111111108',
    name: 'Конструктор (300 деталей)',
    qtyLabel: '1 × 2 490 сом',
    priceMinor: 249000,
    category: 'Конструкторы',
  },
];

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderNumber = decodeURIComponent(id || '38472');

  return (
    <div className="sf-stack sf-order-detail-page">
      <div className="sf-order-detail-topbar">
        <Link href="/orders" className="sf-co-back-btn">
          <Icon name="arrowLeft" width={16} height={16} />
          <span>Мои заказы</span>
        </Link>
        <h1>Заказ №{orderNumber}</h1>
      </div>

      <div className="sf-order-detail-grid">
        <section className="sf-order-timeline-card">
          <div className="sf-order-status-banner">
            <span className="sf-order-status-banner__icon">
              <Icon name="refresh" width={20} height={20} />
            </span>
            <div>
              <strong>В обработке</strong>
              <small>Ваш заказ принят и формируется в магазине</small>
            </div>
          </div>

          <div
            className="sf-vertical-timeline"
            aria-label="Этапы выполнения заказа"
          >
            <div className="sf-vt-step sf-vt-step--done">
              <span className="sf-vt-dot">
                <Icon name="check" width={13} height={13} />
              </span>
              <div className="sf-vt-copy">
                <strong>Заказ оформлен</strong>
                <small>12 мая, 14:25</small>
              </div>
            </div>

            <div className="sf-vt-step sf-vt-step--active">
              <span className="sf-vt-dot">
                <Icon name="check" width={13} height={13} />
              </span>
              <div className="sf-vt-copy">
                <strong>В обработке</strong>
                <small>Подготавливаем ваш заказ</small>
              </div>
            </div>

            <div className="sf-vt-step">
              <span className="sf-vt-dot" />
              <div className="sf-vt-copy">
                <strong>Готов к выдаче</strong>
                <small>Ожидает комплектации</small>
              </div>
            </div>

            <div className="sf-vt-step">
              <span className="sf-vt-dot" />
              <div className="sf-vt-copy">
                <strong>Завершён</strong>
                <small>Получение в магазине или курьером</small>
              </div>
            </div>
          </div>
        </section>

        <section className="sf-order-confirmed-card">
          <div className="sf-section-heading">
            <h2 className="sf-order-comp-title">
              Состав заказа ({ORDER_ITEMS.length})
            </h2>
            <Link href="/shop/mir-igrushek" className="sf-recs-all-link">
              Мир игрушек ›
            </Link>
          </div>

          <div className="sf-order-comp-list">
            {ORDER_ITEMS.map((item) => (
              <div key={item.id} className="sf-order-comp-row">
                <div className="sf-order-comp-thumb">
                  <ProductPhoto alt={item.name} category={item.category} />
                </div>
                <div className="sf-order-comp-info">
                  <strong>{item.name}</strong>
                  <small>{item.qtyLabel}</small>
                </div>
                <Price minor={item.priceMinor} />
              </div>
            ))}
          </div>

          <div className="sf-order-comp-footer">
            <div className="sf-order-comp-line">
              <span>Способ получения</span>
              <strong>Самовывоз (ТЦ «Берекет», 2 этаж)</strong>
            </div>
            <div className="sf-order-comp-grand">
              <strong>Итого:</strong>
              <Price minor={577000} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
