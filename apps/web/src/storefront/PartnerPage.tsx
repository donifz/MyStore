import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, errorText } from '../api/client';
export default function PartnerPage() {
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [phone, setPhone] = useState(''),
    [city, setCity] = useState(''),
    [address, setAddress] = useState(''),
    [category, setCategory] = useState(''),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
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
        <p className="eyebrow">Ваш магазин на MyStore</p>
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
        <p className="muted">
          Отправьте заявку. Администратор свяжется с вами после проверки.
        </p>
      </div>
      <div className="panel partner-form">
        <h2>Стать партнёром</h2>
        {done ? (
          <>
            <p role="status" className="success">
              Заявка отправлена. Мы свяжемся с вами после проверки.
            </p>
            <p>
              Кабинет станет доступен после одобрения и активации по ссылке.
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Название магазина
                <input
                  required
                  maxLength={200}
                  autoComplete="organization"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Телефон
                <input
                  required
                  type="tel"
                  minLength={7}
                  maxLength={30}
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label>
                Город
                <input
                  required
                  maxLength={80}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
              <label>
                Адрес
                <input
                  maxLength={250}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <label>
                Категория бизнеса
                <input
                  required
                  maxLength={80}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </label>
              <label>
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
                {busy ? 'Отправка…' : 'Отправить заявку'}
              </button>
            </fieldset>
            <p>
              Уже есть аккаунт? <Link to="/seller/login">Войти</Link>
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
