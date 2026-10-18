import { FormEvent, useEffect, useState } from 'react';
import { useAccessOperation } from '../auth/use-access-operation';
type Created = {
  email: string;
  temporaryPassword: string | null;
  existingAccount: boolean;
};
export default function DirectStaffForm({
  base,
  disabled,
  onCreated,
  onLock,
}: {
  base: string;
  disabled: boolean;
  onCreated: () => Promise<void>;
  onLock: (locked: boolean) => void;
}) {
  const op = useAccessOperation<Created>(),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('cashier'),
    [hidden, setHidden] = useState(false);
  useEffect(() => {
    onLock(op.busy || op.pending);
  }, [op.busy, op.pending, onLock]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setHidden(false);
    if (await op.run(base + '/direct', { email, role })) {
      setEmail('');
      await onCreated();
    }
  }
  return (
    <section className="panel">
      <h2>Добавить сотрудника без почты</h2>
      <p className="muted">
        Почтовый сервис не требуется. Передайте начальный пароль сотруднику
        лично.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={disabled || op.busy || op.pending}>
          <label>
            Email нового сотрудника
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Роль нового сотрудника
            <select
              aria-label="Роль нового сотрудника"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="manager">Менеджер</option>
              <option value="cashier">Кассир</option>
            </select>
          </label>
          <button type="submit" className="primary">
            {op.busy ? 'Создание…' : 'Создать сотрудника'}
          </button>
        </fieldset>
      </form>
      {op.error && (
        <p role="alert" className="error">
          {op.error}
        </p>
      )}
      {op.pending && (
        <button
          type="button"
          disabled={op.busy}
          onClick={async () => {
            if (await op.retry()) await onCreated();
          }}
        >
          Повторить создание сотрудника
        </button>
      )}
      {op.result && !hidden && (
        <div role="status">
          <h3>Сотрудник добавлен</h3>
          <p>{op.result.email}</p>
          {op.result.temporaryPassword ? (
            <p>
              Начальный пароль: <strong>{op.result.temporaryPassword}</strong>.
              Передайте его лично и попросите сменить пароль.
            </p>
          ) : (
            <p>
              У сотрудника уже есть аккаунт MyStore. Он входит со своим
              существующим паролем.
            </p>
          )}
          <button type="button" onClick={() => setHidden(true)}>
            Скрыть пароль
          </button>
        </div>
      )}
    </section>
  );
}
