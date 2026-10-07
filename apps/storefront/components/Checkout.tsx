'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatSom } from '../lib/public-api';
import { useCart } from './CartProvider';
type Receipt = {
  id: string;
  status: string;
  totalMinor: number;
  expiresAt: string | null;
  storeName: string;
};
const statuses: Record<string, string> = {
  new: 'Ожидает подтверждения',
  confirmed: 'Подтверждён',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменён',
  expired: 'Срок подтверждения истёк',
};
class PublicError extends Error {
  constructor(
    public status: number,
    public details: any,
  ) {
    super('Request failed');
  }
}
async function post(path: string, body: unknown): Promise<Receipt> {
  const r = await fetch('/api/public/orders' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await r.json();
  if (!r.ok) throw new PublicError(r.status, data);
  return data;
}
export default function Checkout() {
  const c = useCart(),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [fulfillment, setFulfillment] = useState('pickup'),
    [address, setAddress] = useState(''),
    [comment, setComment] = useState(''),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(''),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [unknown, setUnknown] = useState(false);
  const sending = useRef(false);
  async function recover() {
    if (!c.checkoutKey) return;
    setChecking(true);
    setError('');
    try {
      const r = await post('/receipt', { checkoutKey: c.checkoutKey });
      setReceipt(r);
      c.clear();
      setUnknown(false);
    } catch (e) {
      if (e instanceof PublicError && e.status === 404) {
        setUnknown(false);
        setError(
          'Заказ пока не найден. Можно повторить оформление с тем же ключом.',
        );
      } else {
        setUnknown(true);
        setError(
          'Не удалось проверить заказ. Проверьте связь и повторите проверку.',
        );
      }
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if (c.ready && c.checkoutKey) void recover();
  }, [c.ready]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending.current || !c.items.length) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const key = c.checkoutKey || crypto.randomUUID();
      c.setKey(key);
      const body = {
        checkoutKey: key,
        storeSlug: c.items[0].storeSlug,
        name,
        phone,
        fulfillment,
        address: fulfillment === 'delivery' ? address : '',
        comment,
        lines: c.items.map((l) => ({
          variantId: l.id,
          quantity: l.quantity,
          expectedUnitPriceMinor: l.price,
        })),
      };
      const r = await post('', body);
      setReceipt(r);
      c.clear();
      setName('');
      setPhone('');
      setAddress('');
      setComment('');
      setUnknown(false);
    } catch (e) {
      setUnknown(true);
      if (e instanceof PublicError && e.status < 500) {
        try {
          const r = await post('/receipt', {
            checkoutKey:
              c.checkoutKey || sessionStorage.getItem('mystore-checkout-key'),
          });
          setReceipt(r);
          c.clear();
          setUnknown(false);
        } catch (lookup) {
          if (lookup instanceof PublicError && lookup.status === 404) {
            c.setKey('');
            setUnknown(false);
            setError(
              e.status === 409
                ? e.details?.currentUnitPriceMinor !== undefined
                  ? 'Цена товара изменилась. Удалите товар и добавьте его по новой цене.'
                  : 'Недостаточно товара или заказ уже изменился. Проверьте корзину.'
                : e.status === 429
                  ? 'Слишком много попыток или неподтверждённых заказов. Попробуйте позднее.'
                  : 'Проверьте имя, телефон и адрес доставки.',
            );
          } else
            setError(
              'Результат неизвестен. Проверьте заказ перед повторным оформлением.',
            );
        }
      } else
        setError(
          'Результат неизвестен. Проверьте заказ перед повторным оформлением.',
        );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  if (!c.ready || checking)
    return <p role="status">Проверяем корзину и заказ…</p>;
  if (receipt)
    return (
      <section className="panel checkout-panel">
        <p className="eyebrow">{receipt.storeName}</p>
        <h1>Заказ принят</h1>
        <p>Номер: {receipt.id}</p>
        <p role="status">{statuses[receipt.status]}</p>
        <p>Товары: {formatSom(receipt.totalMinor)}</p>
        <p>Оплата при получении. Доставку согласуйте с магазином.</p>
        {receipt.expiresAt && (
          <p>
            Магазину нужно подтвердить заказ до{' '}
            {new Date(receipt.expiresAt).toLocaleString('ru-RU')}.
          </p>
        )}
        <button disabled={checking} onClick={() => void recover()}>
          Обновить статус
        </button>
        <button
          onClick={() => {
            c.setKey('');
            setReceipt(null);
          }}
        >
          Новый заказ
        </button>
        <Link href="/shops">Магазины</Link>
      </section>
    );
  const total = Number(
    c.items.reduce((n, l) => n + BigInt(l.quantity) * BigInt(l.price), 0n),
  );
  return (
    <>
      <h1>Корзина</h1>
      {c.error && <p role="alert">{c.error}</p>}
      {error && <p role="alert">{error}</p>}
      {c.checkoutKey && (
        <button disabled={busy} onClick={() => void recover()}>
          Проверить заказ
        </button>
      )}
      {!c.items.length ? (
        <div className="market-empty">
          <p>Корзина пока пуста.</p>
          <Link href="/">Выбрать товары</Link>
          <button
            onClick={() => {
              c.clear();
              c.setKey('');
            }}
          >
            Очистить корзину
          </button>
        </div>
      ) : (
        <>
          <p>Магазин: {c.items[0].storeName}</p>
          <section className="panel">
            {c.items.map((l) => (
              <div className="cart-row" key={l.id}>
                <Link href={`/shops/${l.storeSlug}/products/${l.id}`}>
                  {l.name}
                </Link>
                <span>{formatSom(l.price)}</span>
                <label>
                  Количество
                  <input
                    aria-label={`Количество ${l.name}`}
                    type="number"
                    min="1"
                    max="1000000"
                    value={l.quantity}
                    disabled={busy || unknown}
                    onChange={(e) => c.quantity(l.id, Number(e.target.value))}
                  />
                </label>
                <button
                  disabled={busy || unknown}
                  onClick={() => c.remove(l.id)}
                >
                  Удалить
                </button>
              </div>
            ))}
            <strong>Товары: {formatSom(total)}</strong>
          </section>
          <form className="panel checkout-panel" onSubmit={submit}>
            <h2>Оформление заказа</h2>
            <fieldset disabled={busy || unknown}>
              <label>
                Ваше имя
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Ваш телефон
                <input
                  required
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label>
                Получение
                <select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                >
                  <option value="pickup">Самовывоз</option>
                  <option value="delivery">Доставка</option>
                </select>
              </label>
              {fulfillment === 'delivery' && (
                <label>
                  Адрес доставки
                  <input
                    required
                    maxLength={250}
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
              )}
              <label>
                Комментарий
                <textarea
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              <p>
                Оплата при получении. Стоимость доставки согласуется отдельно с
                магазином.
              </p>
              <button className="primary">
                {busy ? 'Оформление…' : 'Подтвердить заказ'}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </>
  );
}
