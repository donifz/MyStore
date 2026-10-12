import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText, setCsrf } from '../api/client';
import { useAccessOperation } from './use-access-operation';
import { useMemoryToken } from './use-memory-token';
import { useSession } from './SessionProvider';
export default function StaffActivationPage() {
  const token = useMemoryToken(),
    session = useSession(),
    op = useAccessOperation();
  const [password, setPassword] = useState(''),
    [email, setEmail] = useState(''),
    [existing, setExisting] = useState(false),
    [loginBusy, setLoginBusy] = useState(false),
    [loginError, setLoginError] = useState('');
  async function signIn(e: FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      const r = await api<{ csrfToken: string }>('/auth/web/login', {
        method: 'POST',
        body: { email, password },
      });
      setCsrf(r.csrfToken);
      await session.refresh();
      setPassword('');
    } catch (e) {
      setLoginError(errorText(e));
    } finally {
      setLoginBusy(false);
    }
  }
  async function accept(e: FormEvent) {
    e.preventDefault();
    if (
      await op.run('/auth/staff/accept', {
        token,
        ...(!session.user ? { password } : {}),
      })
    ) {
      setPassword('');
      await session.refresh();
    }
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Приглашение в магазин</h1>
        {op.success ? (
          <>
            <p role="status">Приглашение принято. Доступ к магазину выдан.</p>
            <Link to={session.user ? '/seller' : '/seller/login'}>
              Перейти в кабинет
            </Link>
          </>
        ) : !token ? (
          <p role="alert">
            Ссылка отсутствует. Попросите владельца выслать новое приглашение.
          </p>
        ) : (
          <>
            {session.user ? (
              <p>
                Вы вошли как {session.user.email}. Приглашение должно быть
                отправлено на эту почту.{' '}
                <button
                  type="button"
                  disabled={op.busy || op.pending}
                  onClick={() =>
                    void session
                      .logout()
                      .catch((e) => setLoginError(errorText(e)))
                  }
                >
                  Выйти из аккаунта
                </button>
              </p>
            ) : (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={existing}
                  disabled={op.busy || op.pending || loginBusy}
                  onChange={(e) => {
                    setExisting(e.target.checked);
                    setPassword('');
                  }}
                />
                У меня уже есть аккаунт MyStore
              </label>
            )}
            {existing && !session.user ? (
              <form onSubmit={signIn}>
                <label>
                  Email приглашённого аккаунта
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    disabled={loginBusy}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Пароль аккаунта
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={256}
                    value={password}
                    disabled={loginBusy}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="primary" disabled={loginBusy}>
                  Войти в приглашённый аккаунт
                </button>
              </form>
            ) : (
              <form onSubmit={accept}>
                {!session.user && (
                  <>
                    <p className="muted">
                      Создайте пароль для нового аккаунта. Если вы уже
                      зарегистрированы, выберите вход выше.
                    </p>
                    <label>
                      Пароль нового аккаунта
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={256}
                        value={password}
                        disabled={op.busy || op.pending}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <button
                  className="primary"
                  disabled={op.busy || op.pending || session.loading}
                >
                  Принять приглашение
                </button>
              </form>
            )}
            {op.pending && (
              <button
                type="button"
                disabled={op.busy}
                onClick={async () => {
                  if (await op.retry()) await session.refresh();
                }}
              >
                Повторить операцию
              </button>
            )}
          </>
        )}
        {(op.error || loginError) && (
          <p role="alert" className="error">
            {op.error || loginError}
          </p>
        )}
        <p className="muted">Приглашение действует 7 дней.</p>
      </div>
    </div>
  );
}
