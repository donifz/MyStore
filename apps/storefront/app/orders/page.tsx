'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';
import { EmptyState, LinkButton } from '../../components/ui';
import Price from '../../components/storefront/Price';
import Icon from '../../components/storefront/Icon';

type OrderItemSummary = {
  id: string;
  orderNumber: string;
  statusKey: 'processing' | 'ready' | 'done';
  statusLabel: string;
  totalMinor: number;
  storeName: string;
};

function getOrderStatusMeta(status: string): {
  statusKey: 'processing' | 'ready' | 'done';
  statusLabel: string;
} {
  if (status === 'ready') {
    return { statusKey: 'ready', statusLabel: 'Готов к выдаче' };
  }
  if (status === 'issued') {
    return { statusKey: 'done', statusLabel: 'Завершён' };
  }
  if (status === 'cancelled') {
    return { statusKey: 'done', statusLabel: 'Отменён' };
  }
  if (status === 'expired') {
    return { statusKey: 'done', statusLabel: 'Истёк срок' };
  }
  if (status === 'confirmed') {
    return { statusKey: 'processing', statusLabel: 'Подтверждён' };
  }
  return { statusKey: 'processing', statusLabel: 'В обработке' };
}

export default function OrdersPage() {
  const c = useCart();
  const [tab, setTab] = useState<'all' | 'processing' | 'ready' | 'done'>(
    'all',
  );

  const liveOrders: OrderItemSummary[] = c.state.receipts.map((r) => {
    const meta = getOrderStatusMeta(r.status);
    return {
      id: r.id,
      orderNumber: r.id.length > 8 ? r.id.slice(0, 8).toUpperCase() : r.id,
      statusKey: meta.statusKey,
      statusLabel: meta.statusLabel,
      totalMinor: r.totalMinor,
      storeName: r.storeName,
    };
  });

  const filtered = liveOrders.filter(
    (o) => tab === 'all' || o.statusKey === tab,
  );

  return (
    <div className="sf-stack sf-orders-page">
      <nav className="sf-breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/">Главная</Link>
        <span>›</span>
        <span>Мои заказы</span>
      </nav>

      <div className="sf-orders-page-head">
        <h1>Мои заказы</h1>
        {liveOrders.length > 0 && (
          <div
            className="sf-orders-filter-tabs"
            role="tablist"
            aria-label="Статус заказов"
          >
            {[
              { key: 'all', label: 'Все' },
              { key: 'processing', label: 'В обработке' },
              { key: 'ready', label: 'Готовы' },
              { key: 'done', label: 'Завершены' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`sf-orders-tab-pill ${tab === t.key ? 'sf-orders-tab-pill--active' : ''}`}
                onClick={() => setTab(t.key as typeof tab)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!c.ready ? null : liveOrders.length === 0 ? (
        <EmptyState
          icon="box"
          title="Заказов пока нет"
          description="Здесь отображаются онлайн-заказы, оформленные в этом браузере. Покупки и бонусы также доступны в личном кабинете."
          action={
            <>
              <a href="/buyer" className="sf-button sf-button--primary">
                Личный кабинет
              </a>
              <LinkButton href="/catalog" variant="secondary">
                Перейти в каталог
              </LinkButton>
            </>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="box"
          title="Нет заказов в этом статусе"
          description="Выберите вкладку «Все», чтобы увидеть все оформленные заказы."
        />
      ) : (
        <div className="sf-orders-card-grid">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${encodeURIComponent(order.id)}`}
              className="sf-my-order-card"
            >
              <div className="sf-my-order-top">
                <div>
                  <strong>Заказ №{order.orderNumber}</strong>
                  <small>{order.storeName}</small>
                </div>
                <span
                  className={`sf-my-order-status sf-my-order-status--${order.statusKey}`}
                >
                  {order.statusLabel}
                </span>
              </div>

              <div className="sf-my-order-bottom">
                <div className="sf-my-order-thumbs">
                  <span className="sf-my-order-thumb">
                    <Icon name="box" width={20} height={20} />
                  </span>
                </div>
                <div className="sf-my-order-price-wrap">
                  <Price minor={order.totalMinor} />
                  <Icon name="chevronRight" width={18} height={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
