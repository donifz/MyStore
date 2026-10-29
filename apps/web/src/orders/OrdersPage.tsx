import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { Page } from '../api/types';
import { formatSom, formatDate } from '../api/money';
import { useSession } from '../auth/SessionProvider';
import { useCurrentShift } from '../pos/use-current-shift';
import { useDocument } from '../drafts/use-document';
import OrderDeadline from './OrderDeadline';
type Order = {
  id: string;
  status: string;
  name: string;
  phone: string;
  fulfillment: string;
  address: string;
  comment: string;
  totalMinor: number;
  createdAt: string;
  expiresAt: string | null;
  timeZone: string;
  saleId: string | null;
  lines?: {
    variantId: string;
    name: string;
    barcode: string;
    quantity: number;
    unitPriceMinor: number;
  }[];
};
const labels: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменён',
  expired: 'Срок истёк',
};
function OrderDetail({
  shopId,
  id,
  userId,
  role,
}: {
  shopId: string;
  id: string;
  userId: string;
  role: string;
}) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [trigger, setTrigger] = useState(0),
    [method, setMethod] = useState<'cash' | 'card'>('cash');
  const document = useDocument({ shopId, userId, kind: 'order-issue' }),
    shift = useCurrentShift(shopId, String(trigger));
  const path = `/shops/${shopId}/orders/${id}/issue`,
    pending = document.draft.submission;
  const otherPending = !!pending && pending.path !== path;
  useEffect(() => {
    const controller = new AbortController();
    setOrder(null);
    api<Order>(`/shops/${shopId}/orders/${id}`, { signal: controller.signal })
      .then(setOrder)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      });
    return () => controller.abort();
  }, [shopId, id, trigger]);
  async function change(status: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/shops/${shopId}/orders/${id}/status`, {
        method: 'POST',
        body: { status },
      });
      setTrigger((x) => x + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function issue() {
    const current =
      shift.current && 'id' in shift.current ? shift.current : null;
    if (!current && !pending) return;
    const r = await document.send(
      path,
      pending?.body ?? { shiftId: current!.id, method },
    );
    if (r) setTrigger((x) => x + 1);
  }
  return (
    <section className="panel order-detail">
      <Link className="back-link" to={`/seller/${shopId}/orders`}>
        ← Все заказы
      </Link>
      <h1>Заказ {id.slice(0, 8)}</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {document.error && (
        <p role="alert" className="error">
          {document.error}
        </p>
      )}
      {shift.error && (
        <p role="alert" className="error">
          {shift.error}
        </p>
      )}
      {!order ? (
        <p role="status">Загрузка заказа…</p>
      ) : (
        <>
          <p className="badge" style={{ display: 'inline-block' }}>
            {labels[order.status]}
          </p>
          <h2>{order.name}</h2>
          <a href={`tel:+${order.phone}`}>+{order.phone}</a>
          <p>{order.fulfillment === 'delivery' ? 'Доставка' : 'Самовывоз'}</p>
          {order.address && <p>{order.address}</p>}
          {order.comment && <p>{order.comment}</p>}
          <p>{formatDate(order.createdAt)}</p>
          <OrderDeadline
            expiresAt={order.expiresAt}
            timeZone={order.timeZone}
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Количество</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {order.lines?.map((l) => (
                  <tr key={l.variantId}>
                    <td>
                      {l.name}
                      <small>{l.barcode}</small>
                    </td>
                    <td>{l.quantity}</td>
                    <td>{formatSom(l.unitPriceMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>Товары: {formatSom(order.totalMinor)}</strong>
          </p>
          <p className="muted">
            Оплата при получении. Доставку согласуйте с покупателем отдельно.
          </p>
          {role !== 'cashier' && (
            <div className="order-actions">
              {order.status === 'new' && (
                <button
                  disabled={busy || document.busy}
                  onClick={() => void change('confirmed')}
                >
                  Подтвердить
                </button>
              )}
              {order.status === 'confirmed' && (
                <button
                  disabled={busy || document.busy}
                  onClick={() => void change('ready')}
                >
                  Готов к выдаче
                </button>
              )}
              {['new', 'confirmed', 'ready'].includes(order.status) && (
                <button
                  className="danger"
                  disabled={busy || document.busy || !!pending}
                  onClick={() => void change('cancelled')}
                >
                  Отменить заказ
                </button>
              )}
            </div>
          )}
          {otherPending ? (
            <p role="alert" className="notice">
              Есть неподтверждённая выдача другого заказа.{' '}
              <Link
                to={pending!
                  .path!.replace('/shops/', '/seller/')
                  .replace('/issue', '')}
              >
                Открыть её
              </Link>
            </p>
          ) : (
            (order.status === 'ready' || pending) && (
              <div className="order-actions">
                <label>
                  Оплата
                  <select
                    disabled={!!pending || document.busy}
                    value={method}
                    onChange={(e) =>
                      setMethod(e.target.value as 'cash' | 'card')
                    }
                  >
                    <option value="cash">Наличные</option>
                    <option value="card">Карта</option>
                  </select>
                </label>
                {!shift.current || !('id' in shift.current) ? (
                  <p>
                    Откройте свою{' '}
                    <Link to={`/seller/${shopId}/shift`}>смену</Link> для
                    выдачи.
                  </p>
                ) : null}
                <button
                  className="primary"
                  disabled={
                    busy ||
                    document.busy ||
                    document.blocked ||
                    !document.online ||
                    (!pending &&
                      (!shift.current ||
                        !('id' in shift.current) ||
                        shift.loading))
                  }
                  onClick={() => void issue()}
                >
                  {document.busy
                    ? 'Проведение…'
                    : pending
                      ? 'Повторить выдачу'
                      : 'Выдать и провести продажу'}
                </button>
              </div>
            )
          )}
          <div className="actions" style={{ marginTop: '0.75rem' }}>
            {order.saleId && (
              <Link
                className="button"
                to={`/seller/${shopId}/sales/${order.saleId}`}
              >
                Открыть продажу
              </Link>
            )}
            <button
              disabled={busy || document.busy}
              onClick={() => setTrigger((x) => x + 1)}
            >
              Обновить заказ
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export default function OrdersPage() {
  const { shopId, id } = useParams(),
    session = useSession(),
    shop = session.user?.shops.find((s) => s.id === shopId),
    [data, setData] = useState<Page<Order> | null>(null),
    [page, setPage] = useState(1),
    [statusFilter, setStatusFilter] = useState(''),
    [searchQuery, setSearchQuery] = useState(''),
    [trigger, setTrigger] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    if (id) return;
    const controller = new AbortController();
    setData(null);
    setError('');
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set('status', statusFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    api<Page<Order>>(`/shops/${shopId}/orders?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      });
    return () => controller.abort();
  }, [shopId, page, statusFilter, searchQuery, trigger, id]);
  if (!shop || !session.user) return <p>Нет доступа.</p>;
  if (id)
    return (
      <OrderDetail
        key={shop.id + id}
        shopId={shop.id}
        id={id}
        userId={session.user.userId}
        role={shop.role}
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Заказы с витрины</p>
          <h1>Заказы</h1>
          <p className="muted">
            Подтверждение, подготовка и выдача через кассу
          </p>
        </div>
        <button onClick={() => setTrigger((x) => x + 1)}>Обновить</button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <section className="panel">
        <div
          className="toolbar"
          style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}
        >
          <label className="search-label">
            Поиск заказов
            <input
              type="search"
              value={searchQuery}
              placeholder="Номер, имя или телефон"
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Статус заказа
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все статусы</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!data && !error && <p role="status">Загрузка…</p>}
        {data && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Покупатель</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.id.slice(0, 8)}
                        <small>{formatDate(o.createdAt)}</small>
                      </td>
                      <td>
                        {o.name}
                        <small>+{o.phone}</small>
                      </td>
                      <td>
                        {labels[o.status]}
                        <OrderDeadline
                          expiresAt={o.expiresAt}
                          timeZone={o.timeZone}
                        />
                      </td>
                      <td>{formatSom(o.totalMinor)}</td>
                      <td>
                        <Link
                          className="button"
                          role="button"
                          to={`/seller/${shop.id}/orders/${o.id}`}
                        >
                          Открыть заказ {o.id.slice(0, 8)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && <p>Заказов пока нет.</p>}
            <div className="toolbar">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Назад
              </button>
              <span>Страница {page}</span>
              <button
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Далее
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
