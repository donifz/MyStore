import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, ApiError, errorText, setCsrf } from '../api/client';
import { useSession } from './SessionProvider';
export default function LoginPage() {
  const s = useSession(),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api<{ csrfToken: string }>('/auth/web/login', {
        method: 'POST',
        body: { email, password },
      });
      setCsrf(data.csrfToken);
      setPassword('');
      await s.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Проверьте email и пароль.'
          : errorText(err),
      );
    } finally {
      setBusy(false);
    }
  }
  if (s.loading) return <p className="loading">Загрузка…</p>;
  if (s.user)
    return (
      <Navigate
        to={s.user.platformAdmin ? '/platform/admin' : '/seller'}
        replace
      />
    );
  return (
    <div className="login-wrap">
      <form onSubmit={submit} className="login-card">
        <a href="/" className="brand">
          MyStore<span>Кабинет продавца</span>
        </a>
        <h1>С возвращением</h1>
        <p className="muted">Войдите, чтобы управлять товарами и продажами</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {(error || s.error) && (
          <p role="alert" className="error">
            {error || s.error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
