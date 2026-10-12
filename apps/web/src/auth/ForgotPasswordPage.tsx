import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccessOperation } from './use-access-operation';
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const op = useAccessOperation();
  async function submit(e: FormEvent) {
    e.preventDefault();
    await op.run('/auth/password/forgot', { email });
  }
  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Восстановить доступ</h1>
        <p className="muted">Укажите email, с которым вы входите в MyStore.</p>
        {op.success ? (
          <p role="status">
            Если аккаунт с этой почтой существует, вы получите ссылку
            восстановления. Проверьте также папку «Спам».
          </p>
        ) : (
          <>
            <label>
              Email
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                disabled={op.busy || op.pending}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="primary" disabled={op.busy || op.pending}>
              Отправить ссылку
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
        <Link to="/seller/login">Вернуться ко входу</Link>
      </form>
    </div>
  );
}
