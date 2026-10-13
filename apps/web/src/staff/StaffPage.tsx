import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { useAccessOperation } from '../auth/use-access-operation';
type Member = {
  id: string;
  email: string;
  role: 'owner' | 'manager' | 'cashier';
};
type Invitation = {
  id: string;
  email: string;
  role: 'manager' | 'cashier';
  expires_at: string;
};
export default function StaffPage() {
  const { shopId = '' } = useParams();
  const session = useSession();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  const [data, setData] = useState<{
      members: Member[];
      invitations: Invitation[];
    } | null>(null),
    [email, setEmail] = useState(''),
    [role, setRole] = useState('manager'),
    [error, setError] = useState(''),
    [configured, setConfigured] = useState<boolean | null>(null);
  const op = useAccessOperation();
  const base = '/shops/' + shopId + '/staff';
  async function load() {
    try {
      const [d, s] = await Promise.all([
        api<typeof data>(base),
        api<{ configured: boolean }>('/shops/' + shopId + '/email/status'),
      ]);
      setData(d);
      setConfigured(s.configured);
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    if (shop?.role === 'owner') void load();
  }, [shopId, shop?.role]);
  async function invite(e: FormEvent) {
    e.preventDefault();
    if (await op.run(base + '/invitations', { email, role })) {
      setEmail('');
      await load();
    }
  }
  async function mutate(path: string, body: unknown) {
    if (await op.run(base + path, body)) await load();
  }
  if (session.loading) return <p className="loading">Загрузка…</p>;
  if (shop?.role !== 'owner')
    return (
      <p role="alert">Управлять сотрудниками может только владелец магазина.</p>
    );
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Доступ к магазину</p>
          <h1>Сотрудники</h1>
        </div>
      </div>
      {configured === false && (
        <p role="status" className="muted">
          Почта не настроена или отправка отключена. Для приглашений подключите
          SMTP. Уже выданные права продолжают работать.
        </p>
      )}
      {(error || op.error) && (
        <p role="alert" className="error">
          {error || op.error}
        </p>
      )}
      {op.success && <p role="status">Изменения сохранены.</p>}
      {op.pending && (
        <button
          type="button"
          disabled={op.busy}
          onClick={async () => {
            if (await op.retry()) await load();
          }}
        >
          Повторить операцию
        </button>
      )}
      <form className="panel" onSubmit={invite}>
        <h2>Пригласить сотрудника</h2>
        <fieldset disabled={op.busy || op.pending}>
          <label>
            Email сотрудника
            <input
              type="email"
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Роль
            <select
              aria-label="Роль"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="manager">Менеджер</option>
              <option value="cashier">Кассир</option>
            </select>
          </label>
          <p className="muted">
            Менеджер ведёт товары, склад и заказы. Кассир работает с продажами,
            сменами и возвратами. Приглашение действует 7 дней.
          </p>
          <button className="primary" disabled={op.busy}>
            Пригласить
          </button>
        </fieldset>
      </form>
      {!data && !error && <p className="loading">Загрузка сотрудников…</p>}
      {data && (
        <>
          <div className="panel">
            <h2>Сотрудники магазина</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Доступ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.email}</td>
                      <td>
                        {m.role === 'owner' ? (
                          'Владелец'
                        ) : (
                          <select
                            aria-label={'Роль ' + m.email}
                            value={m.role}
                            disabled={op.busy || op.pending}
                            onChange={(e) =>
                              void mutate('/' + m.id + '/role', {
                                role: e.target.value,
                              })
                            }
                          >
                            <option value="manager">Менеджер</option>
                            <option value="cashier">Кассир</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {m.role !== 'owner' && (
                          <button
                            type="button"
                            disabled={op.busy || op.pending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Отключить доступ ' +
                                    m.email +
                                    ' к этому магазину?',
                                )
                              )
                                void mutate('/' + m.id + '/disable', {});
                            }}
                          >
                            Отключить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h2>Ожидают приглашения</h2>
            {!data.invitations.length && (
              <p className="muted">Нет ожидающих приглашений.</p>
            )}
            <div className="stack">
              {data.invitations.map((i) => (
                <article className="staff-invitation" key={i.id}>
                  <div>
                    <strong>{i.email}</strong>
                    <p className="muted">
                      {i.role === 'manager' ? 'Менеджер' : 'Кассир'} ·{' '}
                      {new Date(i.expires_at) < new Date()
                        ? 'Срок истёк'
                        : 'До ' +
                          new Date(i.expires_at).toLocaleDateString('ru-RU')}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      disabled={op.busy || op.pending}
                      onClick={() =>
                        void mutate('/invitations', {
                          email: i.email,
                          role: i.role,
                        })
                      }
                    >
                      Выслать заново
                    </button>
                    <button
                      type="button"
                      disabled={op.busy || op.pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Отменить приглашение ' + i.email + '?',
                          )
                        )
                          void mutate('/invitations/' + i.id + '/cancel', {});
                      }}
                    >
                      Отменить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
