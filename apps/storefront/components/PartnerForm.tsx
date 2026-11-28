'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Button, Input, Select, Checkbox, Alert } from './ui';

import { api, ApiError, errorText } from '../../web/src/api/client';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from '../../web/src/customers/kyrgyzPhoneMask';

const PARTNER_PERKS = [
  'Касса, чеки и USB-сканер',
  'Остатки, смены и чистая прибыль',
  'Готовая онлайн-витрина магазина',
];

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
          phone: phone.replace(/\s/g, ''),
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
        <span className="sf-partner-badge">30 дней бесплатно · Без карты</span>
        <h1>Касса, учёт и витрина в одном месте</h1>
        <p className="sf-partner-lead">
          Продажи, склад и онлайн-каталог магазина в одном кабинете.
        </p>
        <ul className="sf-partner-perks">
          {PARTNER_PERKS.map((perk) => (
            <li key={perk}>
              <span className="sf-partner-check" aria-hidden="true">
                ✓
              </span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <p className="sf-partner-flow">
          Заявка за 1 минуту → ссылка на вход в WhatsApp
        </p>
      </div>
      <div className="sf-panel sf-partner-form">
        <h2>Стать партнёром</h2>
        {done ? (
          <>
            <Alert variant="success">
              Заявка отправлена. Мы свяжемся с вами после проверки.
            </Alert>
            <p className="sf-partner-done-note">
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
              <div className="sf-partner-row">
                <Input
                  id="partner-phone"
                  label="Телефон"
                  hint="С WhatsApp"
                  required
                  type="tel"
                  maxLength={32}
                  pattern={KYRGYZ_PHONE_PATTERN}
                  title="Номер Кыргызстана: +996 700 123 456"
                  autoComplete="tel"
                  placeholder="+996 700 123 456"
                  value={phone}
                  onChange={(e) =>
                    setPhone(formatKyrgyzPhoneInput(e.target.value))
                  }
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
              </div>
              <div className="sf-partner-row">
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
                  hint="Необязательно"
                  maxLength={250}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <Select
                id="partner-category"
                label="Категория бизнеса"
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
              </Select>
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
                {busy ? 'Отправка…' : 'Попробовать 30 дней бесплатно'}
              </Button>
            </fieldset>
            <p className="sf-partner-login">
              Уже есть аккаунт? <a href="/seller/login">Войти</a>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
