'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  LinkButton,
  Input,
  Select,
  Textarea,
  Alert,
  EmptyState,
  Skeleton,
} from './ui';
import Price from './storefront/Price';
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
    [email, setEmail] = useState(''),
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
    const hadPendingKey = Boolean(c.checkoutKey);
    try {
      const key = c.checkoutKey || crypto.randomUUID();
      c.setKey(key);
      const body = {
        checkoutKey: key,
        storeSlug: c.items[0].storeSlug,
        name,
        phone,
        ...(email.trim() ? { email: email.trim() } : {}),
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
      setEmail('');
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
            // A rejected retry cannot prove an earlier interrupted request
            // will never arrive. Reuse its key until a receipt is recovered.
            if (!hadPendingKey) c.setKey('');
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
    return (
      <section className="sf-stack" aria-busy="true">
        <p role="status">Проверяем корзину и заказ…</p>
        <Skeleton />
        <Skeleton />
      </section>
    );
  if (receipt)
    return (
      <section className="sf-panel sf-stack sf-receipt">
        <div>
          <p className="sf-eyebrow">{receipt.storeName}</p>
          <h1>Заказ принят</h1>
          <p>Номер: {receipt.id}</p>
        </div>
        <Alert variant="success">{statuses[receipt.status]}</Alert>
        <p>
          Товары: <Price minor={receipt.totalMinor} />
        </p>
        <p>Оплата при получении. Доставку согласуйте с магазином.</p>
        {receipt.expiresAt && (
          <p>
            Магазину нужно подтвердить заказ до{' '}
            {new Date(receipt.expiresAt).toLocaleString('ru-RU')}.
          </p>
        )}
        <div className="sf-actions">
          <Button
            variant="secondary"
            disabled={checking}
            onClick={() => void recover()}
          >
            Обновить статус
          </Button>
          <Button
            onClick={() => {
              c.setKey('');
              setReceipt(null);
            }}
          >
            Новый заказ
          </Button>
          <LinkButton href="/shops" variant="ghost">
            Магазины
          </LinkButton>
        </div>
      </section>
    );
  const total = Number(
    c.items.reduce((n, l) => n + BigInt(l.quantity) * BigInt(l.price), 0n),
  );
  return (
    <div className="sf-stack">
      <div>
        <p className="sf-eyebrow">Ваши находки</p>
        <h1>Корзина</h1>
        {c.items.length > 0 && (
          <p className="sf-muted">Магазин: {c.items[0].storeName}</p>
        )}
      </div>
      {c.error && <Alert variant="error">{c.error}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      {c.checkoutKey && (
        <div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void recover()}
          >
            Проверить заказ
          </Button>
        </div>
      )}
      {!c.items.length ? (
        <EmptyState
          title="Корзина пока пуста"
          description="Хорошие находки ждут в каталоге местных магазинов."
          action={
            <div className="sf-actions sf-actions--center">
              <LinkButton href="/">Выбрать товары</LinkButton>
              <Button
                variant="ghost"
                onClick={() => {
                  c.clear();
                  c.setKey('');
                }}
              >
                Очистить корзину
              </Button>
            </div>
          }
        />
      ) : (
        <div className="sf-checkout-grid">
          <section
            className="sf-panel sf-cart-items"
            aria-label="Товары в корзине"
          >
            {c.items.map((l) => (
              <div className="sf-cart-row" key={l.id}>
                <div className="sf-cart-row__name">
                  <Link href={`/shop/${l.storeSlug}/products/${l.id}`}>
                    {l.name}
                  </Link>
                  <Price minor={l.price} />
                </div>
                <Input
                  id={'cart-quantity-' + l.id}
                  label="Количество"
                  aria-label={`Количество ${l.name}`}
                  type="number"
                  min="1"
                  max="1000000"
                  value={l.quantity}
                  disabled={busy || unknown}
                  onChange={(e) => c.quantity(l.id, Number(e.target.value))}
                />
                <Button
                  variant="ghost"
                  disabled={busy || unknown}
                  onClick={() => c.remove(l.id)}
                >
                  Удалить
                </Button>
              </div>
            ))}
            <div className="sf-cart-total">
              <strong>Товары</strong>
              <Price minor={total} />
            </div>
            <p className="sf-muted">
              Доставка согласуется отдельно с магазином.
            </p>
          </section>
          <form className="sf-panel sf-checkout-form" onSubmit={submit}>
            <h2>Оформление заказа</h2>
            <fieldset disabled={busy || unknown}>
              <Input
                id="checkout-name"
                label="Ваше имя"
                required
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                id="checkout-phone"
                label="Ваш телефон"
                required
                type="tel"
                maxLength={30}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                id="checkout-email"
                label="Email для статуса заказа (необязательно)"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                hint="Сообщим об изменении этого заказа. Поле можно оставить пустым."
              />
              <Select
                id="checkout-fulfillment"
                label="Получение"
                value={fulfillment}
                onChange={(e) => setFulfillment(e.target.value)}
              >
                <option value="pickup">Самовывоз</option>
                <option value="delivery">Доставка</option>
              </Select>
              {fulfillment === 'delivery' && (
                <Input
                  id="checkout-address"
                  label="Адрес доставки"
                  required
                  maxLength={250}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              )}
              <Textarea
                id="checkout-comment"
                label="Комментарий"
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="sf-muted">
                Оплата при получении. Стоимость доставки согласуется отдельно с
                магазином.
              </p>
              <Button type="submit" loading={busy} className="sf-full">
                {busy ? 'Оформление…' : 'Подтвердить заказ'}
              </Button>
            </fieldset>
          </form>
        </div>
      )}
    </div>
  );
}
