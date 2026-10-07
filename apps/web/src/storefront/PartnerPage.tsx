import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError, errorText } from '../api/client';
export default function PartnerPage() {
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/partners/register', {
        method: 'POST',
        body: { shopName: name.trim(), email: email.trim(), password },
      });
      setPassword('');
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Этот email уже используется. Войдите в свой аккаунт.'
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
          Онлайн-заказы, фото и печать этикеток будут добавлены следующими
          этапами.
        </p>
      </div>
      <div className="panel partner-form">
        <h2>Стать партнёром</h2>
        {done ? (
          <>
            <p role="status" className="success">
              Магазин создан. Войдите, чтобы настроить витрину.
            </p>
            <p>
              Он пока скрыт от покупателей. Укажите контакты и включите
              публикацию в разделе «Витрина».
            </p>
            <Link className="primary button" to="/seller/login">
              Войти в кабинет
            </Link>
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
                Пароль
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={256}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <p className="muted">
                Минимум 12 символов. Сохраните пароль для входа.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="primary full-width">
                {busy ? 'Создание…' : 'Создать магазин'}
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
