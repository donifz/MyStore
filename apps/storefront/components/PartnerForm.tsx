'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, Checkbox, Alert } from './ui';

import { api, ApiError, errorText } from '../../web/src/api/client';
export default function PartnerPage() {
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [phone, setPhone] = useState(''),
    [city, setCity] = useState(''),
    [address, setAddress] = useState(''),
    [shopType, setShopType] = useState(''),
    [shopTypes, setShopTypes] = useState<{ code: string; name: string }[]>([]),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  useEffect(() => {
    void api<{ code: string; name: string }[]>('/partners/shop-types')
      .then((types) => setShopTypes(types))
      .catch((err) => setError(errorText(err)));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/partners/applications', {
        method: 'POST',
        body: {
          shopName: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          address: address.trim(),
          category:
            shopTypes.find((type) => type.code === shopType)?.name ?? '',
          shopType,
          agreed,
        },
      });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Для этого email уже есть заявка или аккаунт.'
          : errorText(e),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sf-partner-grid">
      <div className="sf-partner-intro">
        <p className="sf-eyebrow">Ваш магазин на MyStore</p>
        <h1>
          Один товар.
          <br />
          Два канала продаж.
        </h1>
        <p>
          Ведите товары и продажи в кабинете. Ваша витрина покажет покупателям
          те же цены и доступное количество.
        </p>
        <ul>
          <li>Свой каталог на площадке</li>
          <li>Приёмка и касса со сканером</li>
          <li>Общие остатки без повторного ввода</li>
        </ul>
        <p className="sf-muted">
          Отправьте заявку. Администратор свяжется с вами и после одобрения
          пришлёт ссылку для активации кабинета.
        </p>
      </div>
      <div className="sf-panel sf-partner-form">
        <h2>Стать партнёром</h2>
        {done ? (
          <>
            <Alert variant="success">
              Заявка отправлена. Мы свяжемся с вами после проверки.
            </Alert>
            <p>
              Кабинет станет доступен после одобрения и активации по ссылке.
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <Input
                id="partner-name"
                label="Название магазина"
                required
                maxLength={200}
                autoComplete="organization"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                id="partner-email"
                label="Email"
                required
                type="email"
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="partner-phone"
                label="Телефон"
                required
                type="tel"
                minLength={7}
                maxLength={30}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Input
                id="partner-city"
                label="Город"
                required
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                id="partner-address"
                label="Адрес"
                maxLength={250}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <label htmlFor="partner-category">Категория бизнеса</label>
              <select
                id="partner-category"
                className="sf-input"
                required
                value={shopType}
                onChange={(event) => setShopType(event.target.value)}
              >
                <option value="" disabled>
                  Выберите тип магазина
                </option>
                {shopTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.name}
                  </option>
                ))}
              </select>
              <Checkbox
                label={
                  <span>
                    Согласен с{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'underline', color: 'inherit' }}
                    >
                      условиями подключения
                    </a>
                  </span>
                }
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" className="sf-full" loading={busy}>
                {busy ? 'Отправка…' : 'Отправить заявку'}
              </Button>
            </fieldset>
            <p>
              Уже есть аккаунт? <a href="/seller/login">Войти</a>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
