'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart, OrderBody, Receipt } from './CartProvider';
import LegacyCheckout from './LegacyCheckout';
import { Button, Input, Textarea, Alert, EmptyState, LinkButton } from './ui';
import Price from './storefront/Price';
import Icon from './storefront/Icon';
import type { Store } from '../lib/public-api';
class OrderError extends Error {
  constructor(
    public status: number,
    public data: any,
  ) {
    super('Order failed');
  }
}
async function post(path: string, body: unknown): Promise<Receipt> {
  const r = await fetch('/api/public/orders' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json();
  if (!r.ok) throw new OrderError(r.status, data);
  return data;
}
const statusLabels: Record<string, string> = {
  new: 'Ожидает подтверждения магазина',
  confirmed: 'Подтверждён',
  ready: 'Готов к выдаче',
  issued: 'Выдан',
  cancelled: 'Отменён',
  expired: 'Срок подтверждения истёк',
};
export default function Checkout() {
  const c = useCart();
  return c.checkoutKey ? <LegacyCheckout /> : <MarketplaceCheckout />;
}
function MarketplaceCheckout() {
  const c = useCart(),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [email, setEmail] = useState(''),
    [address, setAddress] = useState(''),
    [comment, setComment] = useState(''),
    [methods, setMethods] = useState<Record<string, 'pickup' | 'delivery'>>({}),
    [stores, setStores] = useState<Record<string, Store>>({});
  const sending = useRef(false);
  const slugs = [...new Set(c.items.map((l) => l.storeSlug))];
  const signature = slugs.join('|');
  useEffect(() => {
    let live = true;
    void Promise.all(
      slugs.map(async (slug) => {
        try {
          const r = await fetch(
            '/api/public/stores/' + encodeURIComponent(slug),
          );
          if (!r.ok) return;
          const s: Store = await r.json();
          if (live) setStores((old) => ({ ...old, [slug]: s }));
        } catch {
          /* Retry is available through reload. */
        }
      }),
    );
    return () => {
      live = false;
    };
  }, [signature]);
  function method(slug: string) {
    return (
      methods[slug] ||
      (stores[slug]?.pickupEnabled !== false ? 'pickup' : 'delivery')
    );
  }
  async function process(slug: string, retry = false) {
    const initial = c.latest();
    const original = initial.attempts[slug];
    let body = original;
    if (!body) {
      if (retry) return;
      const lines = initial.items.filter((l) => l.storeSlug === slug);
      if (!lines.length) return;
      body = {
        checkoutKey: crypto.randomUUID(),
        storeSlug: slug,
        name,
        phone,
        ...(email.trim() ? { email: email.trim() } : {}),
        fulfillment: method(slug),
        address: method(slug) === 'delivery' ? address : '',
        comment,
        lines: lines.map((l) => ({
          variantId: l.id,
          quantity: l.quantity,
          expectedUnitPriceMinor: l.price,
        })),
      };
      c.save({ ...initial, attempts: { ...initial.attempts, [slug]: body } });
    }
    try {
      let receipt: Receipt;
      if (original) {
        try {
          receipt = await post('/receipt', { checkoutKey: body.checkoutKey });
        } catch (e) {
          if (!(e instanceof OrderError) || e.status !== 404) throw e;
          receipt = await post('', body);
        }
      } else receipt = await post('', body);
      const state = c.latest(),
        attempts = { ...state.attempts };
      delete attempts[slug];
      c.save({
        ...state,
        items: state.items.filter((l) => l.storeSlug !== slug),
        attempts,
        receipts: [
          ...state.receipts.filter((r) => r.id !== receipt.id),
          { ...receipt, checkoutKey: body.checkoutKey },
        ].slice(-50),
      });
      setErrors((e) => ({ ...e, [slug]: '' }));
    } catch (e) {
      // Only a definite first-response rejection permits editing. An interrupted
      // request always retains its exact body and key, even after a later 404.
      if (
        !original &&
        e instanceof OrderError &&
        e.status >= 400 &&
        e.status < 500 &&
        ![408, 425].includes(e.status)
      ) {
        const s = c.latest(),
          attempts = { ...s.attempts };
        delete attempts[slug];
        c.save({ ...s, attempts });
        setErrors((old) => ({
          ...old,
          [slug]:
            e.status === 409
              ? e.data?.currentUnitPriceMinor !== undefined
                ? 'Цена изменилась. Удалите товар и добавьте его снова по текущей цене.'
                : 'Изменилось наличие или способ получения. Проверьте товары и настройки магазина.'
              : e.status === 429
                ? 'Слишком много попыток. Повторите позднее.'
                : 'Заказ не принят. Проверьте контактные данные и товары.',
        }));
      } else
        setErrors((old) => ({
          ...old,
          [slug]:
            'Результат пока неизвестен. Проверьте заказ — повтор использует тот же номер операции.',
        }));
    }
  }
  async function run(slug?: string) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      if (!navigator.locks)
        throw Error(
          'Оформление требует современный браузер с защитой от повторной отправки.',
        );
      await navigator.locks.request('mystore-checkout', async () => {
        const current = c.latest();
        const targets = slug
          ? [slug]
          : [...new Set(current.items.map((l) => l.storeSlug))];
        for (const s of targets) await process(s, Boolean(slug));
      });
    } catch (e) {
      setErrors((old) => ({
        ...old,
        global:
          e instanceof Error
            ? e.message
            : 'Не удалось сохранить заказ. Повторите проверку.',
      }));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function refreshOrders() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      for (const receipt of c.latest().receipts) {
        if (!receipt.checkoutKey) continue;
        const current = await post('/receipt', {
          checkoutKey: receipt.checkoutKey,
        });
        const state = c.latest();
        c.save({
          ...state,
          receipts: state.receipts.map((r) =>
            r.id === receipt.id
              ? { ...current, checkoutKey: receipt.checkoutKey }
              : r,
          ),
        });
      }
      setErrors((old) => ({ ...old, global: '' }));
    } catch {
      setErrors((old) => ({
        ...old,
        global: 'Не удалось обновить статус. Повторите позднее.',
      }));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void run();
  }
  if (!c.ready) return <p role="status">Загружаем корзину…</p>;
  const total = Number(
    c.items.reduce((sum, l) => sum + BigInt(l.price) * BigInt(l.quantity), 0n),
  );
  return (
    <div className="sf-stack">
      <div className="sf-section-heading">
        <div>
          <h1>Корзина</h1>
          <p className="sf-muted">
            {slugs.length} магазинов ·{' '}
            {c.items.reduce((n, l) => n + l.quantity, 0)} товаров
          </p>
        </div>
        {c.items.length > 0 && (
          <Button
            variant="ghost"
            disabled={busy || Object.keys(c.state.attempts).length > 0}
            onClick={c.clear}
          >
            <Icon name="trash" />
            Очистить корзину
          </Button>
        )}
      </div>
      {c.error && <Alert variant="error">{c.error}</Alert>}
      {errors.global && <Alert variant="error">{errors.global}</Alert>}
      {c.state.receipts.length > 0 && (
        <section className="sf-panel sf-stack">
          <div className="sf-section-heading">
            <h2>Ваши заказы</h2>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => void refreshOrders()}
            >
              Обновить статусы
            </Button>
          </div>
          {c.state.receipts.map((r) => (
            <div className="sf-order-receipt" key={r.id}>
              <Icon name="shield" />
              <div>
                <strong>{r.storeName}</strong>
                <p>{statusLabels[r.status] || r.status}</p>
                <small>№ {r.id}</small>
                {r.expiresAt && r.status === 'new' && (
                  <p className="sf-muted">
                    Подтверждение магазина до{' '}
                    {new Date(r.expiresAt).toLocaleString('ru-RU')}
                  </p>
                )}
              </div>
              <Price minor={r.totalMinor} />
            </div>
          ))}
          <p className="sf-muted">
            Заказы переданы магазинам отдельно. Оплата при получении. Уточнить
            статус можно у продавца.
          </p>
        </section>
      )}
      {!c.items.length ? (
        <EmptyState
          title={
            c.state.receipts.length
              ? 'Все товары оформлены'
              : 'В корзине пока пусто'
          }
          description="Найдите что-нибудь полезное в магазинах рядом."
          action={<LinkButton href="/">Перейти к товарам</LinkButton>}
        />
      ) : (
        <div className="sf-cart-layout">
          <div className="sf-stack">
            {slugs.map((slug) => {
              const lines = c.items.filter((l) => l.storeSlug === slug),
                pending = c.state.attempts[slug];
              const store = stores[slug];
              return (
                <section key={slug} className="sf-cart-shop sf-panel">
                  <div className="sf-cart-shop-heading">
                    <Link href={'/shop/' + slug}>
                      <span className="sf-mini-logo">
                        <Icon name="shop" />
                      </span>
                      <strong>{lines[0].storeName}</strong>
                      <Icon name="arrow" />
                    </Link>
                    <span className="sf-muted">{lines.length} позиций</span>
                  </div>
                  <fieldset disabled={busy || !!pending}>
                    <legend className="sf-sr-only">
                      Товары {lines[0].storeName}
                    </legend>
                    {lines.map((l) => (
                      <div className="sf-cart-line" key={l.id}>
                        <Link
                          className="sf-cart-image"
                          href={`/shop/${slug}/products/${l.id}`}
                        >
                          {l.photoUrl ? (
                            <img src={l.photoUrl} alt={l.name} />
                          ) : (
                            <Icon name="box" width={36} height={36} />
                          )}
                        </Link>
                        <div>
                          <Link
                            className="sf-cart-name"
                            href={`/shop/${slug}/products/${l.id}`}
                          >
                            {l.name}
                          </Link>
                          <small className="sf-muted">
                            Цена за штуку <Price minor={l.price} />
                          </small>
                        </div>
                        <Price minor={l.price * l.quantity} />
                        <div className="sf-quantity">
                          <button
                            type="button"
                            aria-label={'Уменьшить ' + l.name}
                            disabled={l.quantity <= 1}
                            onClick={() => c.quantity(l.id, l.quantity - 1)}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            aria-label={'Количество ' + l.name}
                            min="1"
                            max="1000000"
                            value={l.quantity}
                            onChange={(e) =>
                              c.quantity(l.id, Number(e.target.value))
                            }
                          />
                          <button
                            type="button"
                            aria-label={'Увеличить ' + l.name}
                            onClick={() => c.quantity(l.id, l.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <Button
                          variant="ghost"
                          aria-label={'Удалить ' + l.name}
                          onClick={() => c.remove(l.id)}
                        >
                          <Icon name="trash" />
                        </Button>
                      </div>
                    ))}
                    <div className="sf-delivery-options">
                      {!store ? (
                        <p role="status">
                          Проверяем способы получения.{' '}
                          <button
                            type="button"
                            className="sf-text-button"
                            onClick={() => window.location.reload()}
                          >
                            Обновить
                          </button>
                        </p>
                      ) : (
                        <>
                          {store.pickupEnabled !== false && (
                            <label>
                              <input
                                type="radio"
                                name={'method-' + slug}
                                checked={
                                  (pending?.fulfillment || method(slug)) ===
                                  'pickup'
                                }
                                onChange={() =>
                                  setMethods((m) => ({
                                    ...m,
                                    [slug]: 'pickup',
                                  }))
                                }
                              />
                              <Icon name="shop" />
                              <span>
                                <strong>Самовывоз</strong>
                                <small>
                                  {store.address || 'Адрес уточнит магазин'}
                                </small>
                              </span>
                            </label>
                          )}
                          {store.deliveryEnabled && (
                            <label>
                              <input
                                type="radio"
                                name={'method-' + slug}
                                checked={
                                  (pending?.fulfillment || method(slug)) ===
                                  'delivery'
                                }
                                onChange={() =>
                                  setMethods((m) => ({
                                    ...m,
                                    [slug]: 'delivery',
                                  }))
                                }
                              />
                              <Icon name="truck" />
                              <span>
                                <strong>Доставка</strong>
                                <small>
                                  Стоимость и срок согласует магазин
                                </small>
                              </span>
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </fieldset>
                  {errors[slug] && (
                    <Alert variant="error">{errors[slug]}</Alert>
                  )}
                  {pending && (
                    <div className="sf-stack">
                      <Alert variant="info">
                        Этот заказ отправлялся. Сначала проверьте результат.
                      </Alert>
                      <Button loading={busy} onClick={() => void run(slug)}>
                        Проверить / повторить заказ
                      </Button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <aside className="sf-cart-summary">
            <section className="sf-panel sf-stack">
              <h2>Ваш заказ</h2>
              <div className="sf-total-row">
                <span>Товары</span>
                <Price minor={total} />
              </div>
              <div className="sf-total-row">
                <span>Получение</span>
                <span>По каждому магазину</span>
              </div>
              <p className="sf-muted">
                Доставка не включена в сумму товаров и согласуется с продавцом
                до подтверждения.
              </p>
              <div className="sf-total-row sf-grand-total">
                <strong>Итого за товары</strong>
                <Price minor={total} />
              </div>
              <a className="sf-button sf-button--primary" href="#checkout">
                К оформлению <Icon name="arrow" />
              </a>
            </section>
            <div className="sf-trust-note">
              <Icon name="shield" />
              <span>Цены и наличие проверяются магазином при оформлении.</span>
            </div>
          </aside>
          <form
            id="checkout"
            className="sf-panel sf-checkout-details"
            onSubmit={submit}
          >
            <h2>Контактные данные</h2>
            <p className="sf-muted">Заполните один раз для всех магазинов.</p>
            <fieldset disabled={busy}>
              <div className="sf-form-columns">
                <Input
                  id="checkout-name"
                  label="Ваше имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                  autoComplete="name"
                />
                <Input
                  id="checkout-phone"
                  label="Телефон"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  type="tel"
                  autoComplete="tel"
                  maxLength={30}
                />
                <Input
                  id="checkout-email"
                  label="Email (необязательно)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                />
                {slugs.some((s) => method(s) === 'delivery') && (
                  <Input
                    id="checkout-address"
                    label="Адрес доставки"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    maxLength={250}
                    autoComplete="street-address"
                  />
                )}
              </div>
              <Textarea
                id="checkout-comment"
                label="Комментарий магазинам"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
              />
              <p className="sf-muted">
                Оплата при получении. Каждый магазин получит отдельный заказ.
                Если часть товаров недоступна, остальные заказы сохранятся.
              </p>
              <Button
                type="submit"
                loading={busy}
                disabled={
                  slugs.some((s) => !stores[s]) ||
                  !!c.error ||
                  slugs.every((s) => !!c.state.attempts[s])
                }
              >
                Подтвердить заказы <Icon name="arrow" />
              </Button>
            </fieldset>
          </form>
        </div>
      )}
    </div>
  );
}
