import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { useAccessOperation } from '../auth/use-access-operation';
import type { PlatformFinancialGrant } from '../api/types';

export default function PlatformAccessPage() {
  const { shopId = '' } = useParams();
  const session = useSession();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  const [grants, setGrants] = useState<PlatformFinancialGrant[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [durationHours, setDurationHours] = useState('24');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const op = useAccessOperation();

  const base = '/shops/' + shopId + '/platform-access';
  const disabled = op.busy || op.pending || refreshing;

  async function load() {
    setRefreshing(true);
    try {
      const res = await api<{ items: PlatformFinancialGrant[] }>(base);
      setGrants(res.items);
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (shop?.role === 'owner') void load();
  }, [shopId, shop?.role]);

  async function grant(e: FormEvent) {
    e.preventDefault();
    const hours = parseInt(durationHours, 10);
    if (isNaN(hours) || hours < 1 || hours > 168) {
      setError('Срок доступа должен быть от 1 до 168 часов');
      return;
    }
    if (!purpose.trim()) {
      setError('Укажите цель предоставления доступа');
      return;
    }
    const success = await op.run(base, {
      adminEmail: adminEmail.trim(),
      purpose: purpose.trim(),
      durationHours: hours,
    });
    if (success) {
      setAdminEmail('');
      setPurpose('');
      setDurationHours('24');
      await load();
    }
  }

  async function revoke(id: string) {
    const success = await op.run(base + '/' + id + '/revoke', {});
    if (success) {
      await load();
    }
  }

  if (session.loading) return <p className="loading">Загрузка…</p>;
  if (shop?.role !== 'owner') {
    return (
      <p role="alert" className="error">
        Управлять доступом платформы может только владелец магазина.
      </p>
    );
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Безопасность и аудит</p>
          <h1>Доступ платформы</h1>
        </div>
      </div>

      <div className="panel">
        <h2>Предоставить временный финансовый доступ</h2>
        <p className="muted">
          Вы можете предоставить конкретному администратору платформы временный
          read-only доступ к финансовой сводке магазина. Администратор не может
          выдать доступ себе сам. Каждое обращение к финансовым данным
          фиксируется в аудите.
        </p>

        {(error || op.error) && (
          <p role="alert" className="error">
            {error || op.error}
          </p>
        )}

        <form className="stack" onSubmit={grant}>
          <label>
            Email администратора платформы
            <input
              type="email"
              required
              disabled={disabled}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </label>

          <label>
            Цель доступа
            <textarea
              required
              rows={2}
              maxLength={500}
              disabled={disabled}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Например: Аудит расхождения кассы или сверка отчёта"
            />
          </label>

          <label>
            Срок доступа (в часах, от 1 до 168)
            <input
              type="number"
              min={1}
              max={168}
              required
              disabled={disabled}
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
            />
          </label>

          <div className="actions">
            <button type="submit" disabled={disabled}>
              {op.busy ? 'Предоставление доступа…' : 'Предоставить доступ'}
            </button>
            {op.pending && (
              <button type="button" onClick={() => void op.retry()}>
                Повторить запрос
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>История выданных полномочий</h2>
        {loading ? (
          <p className="loading">Загрузка списка…</p>
        ) : !grants.length ? (
          <p className="empty-state">
            Полномочия платформы не выдавались. Доступ к закрытым финансовым
            данным магазина закрыт.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Администратор</th>
                  <th>Цель</th>
                  <th>Срок действия</th>
                  <th>Статус</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => {
                  const isExpired =
                    new Date(g.expiresAt).getTime() <= Date.now();
                  const isRevoked = !!g.revokedAt;
                  return (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.adminEmail}</strong>
                      </td>
                      <td>
                        <span title={g.purpose}>{g.purpose}</span>
                      </td>
                      <td>
                        <small>
                          {new Date(g.createdAt).toLocaleString('ru-RU')} —{' '}
                          {new Date(g.expiresAt).toLocaleString('ru-RU')}
                        </small>
                      </td>
                      <td>
                        {g.active ? (
                          <span className="badge badge--success">Активен</span>
                        ) : isRevoked ? (
                          <span className="badge badge--muted">Отозван</span>
                        ) : isExpired ? (
                          <span className="badge badge--muted">Истёк</span>
                        ) : (
                          <span className="badge">Неактивен</span>
                        )}
                      </td>
                      <td>
                        {g.active && (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => void revoke(g.id)}
                          >
                            Отозвать
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
