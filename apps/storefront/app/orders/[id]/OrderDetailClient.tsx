'use client';

import Link from 'next/link';
import { useCart } from '../../../components/CartProvider';
import { EmptyState, LinkButton } from '../../../components/ui';
import Icon from '../../../components/storefront/Icon';
import Price from '../../../components/storefront/Price';

const STATUS_DESCRIPTIONS: Record<
  string,
  { title: string; subtitle: string; stepIndex: number }
> = {
  new: {
    title: 'В обработке',
    subtitle: 'Ваш заказ принят и ожидает подтверждения магазина',
    stepIndex: 1,
  },
  confirmed: {
    title: 'Подтверждён',
    subtitle: 'Магазин подтвердил заказ и готовит его к выдаче',
    stepIndex: 1,
  },
  ready: {
    title: 'Готов к выдаче',
    subtitle: 'Заказ собран и ожидает получения',
    stepIndex: 2,
  },
  issued: {
    title: 'Завершён',
    subtitle: 'Заказ выдан покупателю',
    stepIndex: 3,
  },
  cancelled: {
    title: 'Отменён',
    subtitle: 'Заказ отменён',
    stepIndex: 0,
  },
  expired: {
    title: 'Срок подтверждения истёк',
    subtitle: 'Магазин не успел подтвердить заказ',
    stepIndex: 0,
  },
};

/**
 * Renders live receipt details for an order stored in the current browser,
 * or an empty state directing the buyer to their personal cabinet when absent.
 */
export default function OrderDetailClient({ id }: { id: string }) {
  const c = useCart();
  const decodedId = decodeURIComponent(id || '').trim();
  const receipt = c.state.receipts.find(
    (r) =>
      r.id === decodedId ||
      r.id.slice(0, 8).toUpperCase() === decodedId.toUpperCase() ||
      r.id.slice(0, 6).toUpperCase() === decodedId.toUpperCase(),
  );

  const displayNumber = receipt
    ? receipt.id.length > 8
      ? receipt.id.slice(0, 8).toUpperCase()
      : receipt.id
    : decodedId;

  if (!c.ready) return null;

  if (!receipt) {
    return (
      <div className="sf-stack sf-order-detail-page">
        <div className="sf-order-detail-topbar">
          <Link href="/orders" className="sf-co-back-btn">
            <Icon name="arrowLeft" width={16} height={16} />
            <span>Мои заказы</span>
          </Link>
          <h1>{displayNumber ? `Заказ №${displayNumber}` : 'Статус заказа'}</h1>
        </div>
        <EmptyState
          icon="box"
          title="Заказ не найден в локальной истории"
          description="Онлайн-заказ отображается в том браузере, где он был оформлен. Покупки и бонусы также доступны в личном кабинете."
          action={
            <>
              <a href="/buyer" className="sf-button sf-button--primary">
                Личный кабинет
              </a>
              <LinkButton href="/orders" variant="secondary">
                К списку заказов
              </LinkButton>
            </>
          }
        />
      </div>
    );
  }

  const statusMeta = STATUS_DESCRIPTIONS[receipt.status] || {
    title: receipt.status,
    subtitle: 'Актуальный статус заказа',
    stepIndex: 1,
  };
  const isClosed =
    receipt.status === 'cancelled' || receipt.status === 'expired';

  const steps = [
    {
      title: 'Заказ оформлен',
      subtitle: receipt.storeName,
    },
    {
      title: receipt.status === 'confirmed' ? 'Подтверждён' : 'В обработке',
      subtitle: 'Подготовка заказа в магазине',
    },
    {
      title: 'Готов к выдаче',
      subtitle: 'Можно забирать в магазине',
    },
    {
      title: 'Завершён',
      subtitle: 'Заказ выдан',
    },
  ];

  return (
    <div className="sf-stack sf-order-detail-page">
      <div className="sf-order-detail-topbar">
        <Link href="/orders" className="sf-co-back-btn">
          <Icon name="arrowLeft" width={16} height={16} />
          <span>Мои заказы</span>
        </Link>
        <h1>Заказ №{displayNumber}</h1>
      </div>

      <div className="sf-order-detail-grid">
        <section className="sf-order-timeline-card">
          <div className="sf-order-status-banner">
            <span className="sf-order-status-banner__icon">
              <Icon name="refresh" width={20} height={20} />
            </span>
            <div>
              <strong>{statusMeta.title}</strong>
              <small>{statusMeta.subtitle}</small>
            </div>
          </div>

          {!isClosed && (
            <div
              className="sf-vertical-timeline"
              aria-label="Этапы выполнения заказа"
            >
              {steps.map((step, idx) => {
                const isDone = idx < statusMeta.stepIndex;
                const isActive = idx === statusMeta.stepIndex;
                const cls = isDone
                  ? 'sf-vt-step sf-vt-step--done'
                  : isActive
                    ? 'sf-vt-step sf-vt-step--active'
                    : 'sf-vt-step';
                return (
                  <div key={step.title} className={cls}>
                    <span className="sf-vt-dot">
                      {(isDone || isActive) && (
                        <Icon name="check" width={13} height={13} />
                      )}
                    </span>
                    <div className="sf-vt-copy">
                      <strong>{step.title}</strong>
                      <small>{step.subtitle}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="sf-order-confirmed-card">
          <div className="sf-section-heading">
            <h2 className="sf-order-comp-title">Детали заказа</h2>
            <span>{receipt.storeName}</span>
          </div>

          <div className="sf-order-comp-footer">
            <div className="sf-order-comp-line">
              <span>Магазин</span>
              <strong>{receipt.storeName}</strong>
            </div>
            <div className="sf-order-comp-grand">
              <strong>Итого:</strong>
              <Price minor={receipt.totalMinor} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
