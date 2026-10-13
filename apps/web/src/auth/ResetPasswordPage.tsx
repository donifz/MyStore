import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccessOperation } from './use-access-operation';
import { useMemoryToken } from './use-memory-token';
export default function ResetPasswordPage() {
  const token = useMemoryToken();
  const [password, setPassword] = useState('');
  const op = useAccessOperation();
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await op.run('/auth/password/reset', { token, password }))
      setPassword('');
  }
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Новый пароль</h1>
        {op.success ? (
          <p role="status">
            Пароль изменён. Войдите снова. Старые сессии завершены.
          </p>
        ) : !token ? (
          <p role="alert">
            Ссылка отсутствует. Запросите новое письмо восстановления.
          </p>
        ) : (
          <>
            <p className="muted">
              Минимум 12 символов. Ссылка действует 30 минут.
            </p>
            <label>
              Новый пароль
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
                disabled={op.busy || op.pending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary" disabled={op.busy || op.pending}>
              Сохранить пароль
            </button>
          </>
        )}
        {op.error && (
          <p role="alert" className="error">
            {op.error}
          </p>
        )}
        {op.pending && (
          <button
            type="button"
            disabled={op.busy}
            onClick={() => void op.retry()}
          >
            Повторить операцию
          </button>
        )}
        <Link to="/seller/login">Войти</Link>
        <Link to="/seller/forgot-password">Запросить новую ссылку</Link>
      </form>
    </div>
  );
}
