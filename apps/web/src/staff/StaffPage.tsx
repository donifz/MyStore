import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { useAccessOperation } from '../auth/use-access-operation';
type Member = {
  id: string;
  email: string;
  role: 'owner' | 'manager' | 'cashier';
  canReturn: boolean;
  canViewReports: boolean;
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
    [created, setCreated] = useState<{ email: string; temporaryPassword: string | null; existingAccount: boolean } | null>(null),
    [creating, setCreating] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [stale, setStale] = useState(true);
  const op = useAccessOperation();
  const base = '/shops/' + shopId + '/staff';
  const disabled = op.busy || op.pending || creating || refreshing || stale;
  async function load() {
    setRefreshing(true);
    setStale(true);
    try {
      const d = await api<typeof data>(base);
      setData(d);
      setStale(false);
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    if (shop?.role === 'owner') void load();
  }, [shopId, shop?.role]);
  async function invite(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreated(null);
    try {
      const result = await api<{ email: string; temporaryPassword: string | null; existingAccount: boolean }>(base + '/direct', {
        method: 'POST',
        key: crypto.randomUUID(),
        body: { email, role },
      });
      setCreated(result);
      setEmail('');
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setCreating(false);
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
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Доступ к магазину</p>
          <h1>Сотрудники</h1>
        </div>
      </div>
      {(error || op.error) && (
        <p role="alert" className="error">
          {error || op.error}
        </p>
      )}
      {error && (
        <button
          type="button"
          disabled={refreshing || op.busy}
          onClick={() => void load()}
        >
          Обновить список
        </button>
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
      {created && (
        <div className="panel" role="status">
          <h2>Сотрудник добавлен</h2>
          <p>{created.email}</p>
          {created.temporaryPassword ? (
            <p>Одноразово покажите сотруднику начальный пароль: <strong>{created.temporaryPassword}</strong>. Передайте его лично и попросите сменить пароль. Не отправляйте пароль в открытые чаты.</p>
          ) : (
            <p>У сотрудника уже есть аккаунт MyStore. Он входит со своим существующим паролем.</p>
          )}
          <button type="button" onClick={() => setCreated(null)}>Скрыть пароль</button>
        </div>
      )}
      <form className="panel" onSubmit={invite}>
        <h2>Добавить сотрудника без почты</h2>
        <fieldset disabled={disabled}>
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
            Менеджер ведёт товары, склад и заказы. Кассир работает с продажами и
            своими сменами. Разрешения на возвраты и финансовые отчёты выдаются
            отдельно в таблице сотрудников. Новый сотрудник получит начальный пароль на этом экране.
          </p>
          <button className="primary" disabled={disabled}>
            {creating ? 'Создание…' : 'Создать сотрудника'}
          </button>
        </fieldset>
      </form>
      {!data && !error && <p className="loading">Загрузка сотрудников…</p>}
      {data && (
        <>
          <div className="panel">
            <h2>Сотрудники магазина</h2>
            <p className="muted">
              Финансовые отчёты открывают себестоимость, прибыль и CSV-выгрузки.
              Возвраты открывают продажи магазина без себестоимости; денежный
              возврат проводится в своей открытой смене. При смене роли
              дополнительные разрешения сбрасываются.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Разрешения</th>
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
                            disabled={disabled}
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
                        {m.role === 'owner' ? (
                          'Полный доступ'
                        ) : (
                          <div className="stack">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                aria-label={'Возвраты ' + m.email}
                                checked={m.canReturn}
                                disabled={disabled}
                                onChange={(e) =>
                                  void mutate('/' + m.id + '/permissions', {
                                    canReturn: e.target.checked,
                                    canViewReports: m.canViewReports,
                                  })
                                }
                              />
                              Возвраты
                            </label>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                aria-label={'Финансовые отчёты ' + m.email}
                                checked={m.canViewReports}
                                disabled={disabled}
                                onChange={(e) =>
                                  void mutate('/' + m.id + '/permissions', {
                                    canReturn: m.canReturn,
                                    canViewReports: e.target.checked,
                                  })
                                }
                              />
                              Финансовые отчёты
                            </label>
                          </div>
                        )}
                      </td>
                      <td>
                        {m.role !== 'owner' && (
                          <button
                            type="button"
                            disabled={disabled}
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
            <h2>Ранее отправленные приглашения</h2>
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
                      disabled={disabled}
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
                      disabled={disabled}
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
