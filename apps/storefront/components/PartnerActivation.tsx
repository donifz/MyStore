'use client';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, errorText } from '../../web/src/api/client';

export default function PartnerActivation() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/partners/invitations/activate', {
        method: 'POST',
        body: { token, password },
      });
      setPassword('');
      setDone(true);
      window.history.replaceState(null, '', '/partner/activate');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel partner-form">
      <h1>Активация магазина</h1>
      {done ? (
        <>
          <p role="status">Кабинет активирован.</p>
          <a href="/seller/login">Войти в кабинет</a>
        </>
      ) : token ? (
        <form onSubmit={submit}>
          <label>
            Новый пароль
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
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Активация…' : 'Активировать кабинет'}
          </button>
        </form>
      ) : (
        <p role="alert">
          Ссылка для активации отсутствует. Свяжитесь с администратором.
        </p>
      )}
    </section>
  );
}
