'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../components/CartProvider';
import Price from '../../components/storefront/Price';
import ProductPhoto from '../../components/storefront/ProductPhoto';
import Icon from '../../components/storefront/Icon';

type OrderItemSummary = {
  id: string;
  orderNumber: string;
  dateLabel: string;
  statusKey: 'processing' | 'ready' | 'done';
  statusLabel: string;
  totalMinor: number;
  storeName: string;
  storeSlug: string;
  items: { name: string; category: string }[];
};

const DEFAULT_ORDERS: OrderItemSummary[] = [
  {
    id: '38472',
    orderNumber: '38472',
    dateLabel: '12 мая, 14:25',
    statusKey: 'processing',
    statusLabel: 'В обработке',
    totalMinor: 577000,
    storeName: 'Мир игрушек',
    storeSlug: 'mir-igrushek',
    items: [
      { name: 'Плюшевый мишка', category: 'Мягкие игрушки' },
      { name: 'Машинка на управлении', category: 'Машинки' },
      { name: 'Конструктор (300 деталей)', category: 'Конструкторы' },
    ],
  },
  {
    id: '38401',
    orderNumber: '38401',
    dateLabel: '10 мая, 11:03',
    statusKey: 'ready',
    statusLabel: 'Готов к выдаче',
    totalMinor: 249000,
    storeName: 'Мир игрушек',
    storeSlug: 'mir-igrushek',
    items: [{ name: 'Конструктор (300 деталей)', category: 'Конструкторы' }],
  },
  {
    id: '38219',
    orderNumber: '38219',
    dateLabel: '2 мая, 16:40',
    statusKey: 'done',
    statusLabel: 'Завершён',
    totalMinor: 199000,
    storeName: 'Мир игрушек',
    storeSlug: 'mir-igrushek',
    items: [{ name: 'Машинка на управлении', category: 'Машинки' }],
  },
];

export default function OrdersPage() {
  const c = useCart();
  const [tab, setTab] = useState<'all' | 'processing' | 'ready' | 'done'>(
    'all',
  );

  const liveOrders: OrderItemSummary[] = c.state.receipts
    .filter((r) => r.id !== '38472')
    .map((r) => ({
      id: r.id,
      orderNumber: r.id.slice(0, 6).toUpperCase(),
      dateLabel: 'Сегодня',
      statusKey:
        r.status === 'ready'
          ? 'ready'
          : r.status === 'issued'
            ? 'done'
            : 'processing',
      statusLabel:
        r.status === 'ready'
          ? 'Готов к выдаче'
          : r.status === 'issued'
            ? 'Завершён'
            : 'В обработке',
      totalMinor: r.totalMinor,
      storeName: r.storeName,
      storeSlug: 'mir-igrushek',
      items: [{ name: 'Плюшевый мишка', category: 'Мягкие игрушки' }],
    }));

  const allOrders = [...liveOrders, ...DEFAULT_ORDERS];
  const filtered = allOrders.filter(
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
      </div>

      <div className="sf-orders-card-grid">
        {filtered.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${encodeURIComponent(order.orderNumber)}`}
            className="sf-my-order-card"
          >
            <div className="sf-my-order-top">
              <div>
                <strong>Заказ №{order.orderNumber}</strong>
                <small>
                  {order.dateLabel} • {order.storeName}
                </small>
              </div>
              <span
                className={`sf-my-order-status sf-my-order-status--${order.statusKey}`}
              >
                {order.statusLabel}
              </span>
            </div>

            <div className="sf-my-order-bottom">
              <div className="sf-my-order-thumbs">
                {order.items.map((it, idx) => (
                  <span key={idx} className="sf-my-order-thumb">
                    <ProductPhoto alt={it.name} category={it.category} />
                  </span>
                ))}
              </div>
              <div className="sf-my-order-price-wrap">
                <Price minor={order.totalMinor} />
                <Icon name="chevronRight" width={18} height={18} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
