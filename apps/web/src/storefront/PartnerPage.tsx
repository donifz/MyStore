import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, errorText } from '../api/client';

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
    [category, setCategory] = useState(''),
    [shopType, setShopType] = useState(''),
    [shopTypes, setShopTypes] = useState<{ code: string; name: string }[]>([]),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  useEffect(() => {
    void api<{ code: string; name: string }[]>('/partners/shop-types')
      .then((types) => setShopTypes(types))
      .catch((error) => setError(errorText(error)));
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
          category: category.trim(),
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
    <section className="partner-grid">
      <div className="partner-intro">
        <span className="partner-badge">30 дней бесплатно · Без карты</span>
        <h1>Касса, учёт и витрина в одном месте</h1>
        <p className="partner-lead">
          Продажи, склад и онлайн-каталог магазина в одном кабинете.
        </p>
        <ul className="partner-perks">
          {PARTNER_PERKS.map((perk) => (
            <li key={perk}>
              <span className="partner-check" aria-hidden="true">
                ✓
              </span>
              <span>{perk}</span>
            </li>
          ))}
        </ul>
        <p className="partner-flow">
          Заявка за 1 минуту → ссылка на вход в WhatsApp
        </p>
      </div>
      <div className="panel partner-form">
        <h2>Стать партнёром</h2>
        {done ? (
          <>
            <p role="status" className="success">
              Заявка отправлена. Мы свяжемся с вами после проверки.
            </p>
            <p className="partner-done-note">
              Кабинет станет доступен после одобрения и активации по ссылке.
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy || shopTypes.length === 0}>
              <div className="partner-field">
                <label htmlFor="web-partner-name">Название магазина</label>
                <input
                  id="web-partner-name"
                  required
                  maxLength={200}
                  autoComplete="organization"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="partner-form-row">
                <div className="partner-field">
                  <label htmlFor="web-partner-phone">Телефон</label>
                  <input
                    id="web-partner-phone"
                    required
                    type="tel"
                    minLength={7}
                    maxLength={30}
                    autoComplete="tel"
                    placeholder="+996 700 123 456"
                    aria-describedby="web-partner-phone-hint"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <span
                    id="web-partner-phone-hint"
                    className="partner-field-hint"
                  >
                    С WhatsApp
                  </span>
                </div>
                <div className="partner-field">
                  <label htmlFor="web-partner-email">Email</label>
                  <input
                    id="web-partner-email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="partner-form-row">
                <div className="partner-field">
                  <label htmlFor="web-partner-city">Город</label>
                  <input
                    id="web-partner-city"
                    required
                    maxLength={80}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="partner-field">
                  <label htmlFor="web-partner-address">Адрес</label>
                  <input
                    id="web-partner-address"
                    maxLength={250}
                    aria-describedby="web-partner-address-hint"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <span
                    id="web-partner-address-hint"
                    className="partner-field-hint"
                  >
                    Необязательно
                  </span>
                </div>
              </div>
              <div className="partner-field">
                <label htmlFor="web-partner-category">Категория бизнеса</label>
                <select
                  id="web-partner-category"
                  required
                  value={shopType}
                  onChange={(e) => {
                    const value = e.target.value;
                    setShopType(value);
                    setCategory(
                      shopTypes.find((type) => type.code === value)?.name ?? '',
                    );
                  }}
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
              </div>
              <label className="partner-agree">
                <input
                  required
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />{' '}
                Согласен с условиями подключения
              </label>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary full-width">
                {busy ? 'Отправка…' : 'Попробовать 30 дней бесплатно'}
              </button>
            </fieldset>
            <p className="partner-login">
              Уже есть аккаунт? <Link to="/seller/login">Войти</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
