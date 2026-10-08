import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useSession } from '../auth/SessionProvider';

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
};
type Audit = {
  id: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export default function OperationsPage() {
  const { shopId = '' } = useParams();
  const session = useSession();
  const shop = session.user?.shops.find((x) => x.id === shopId);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setNotifications(
        await api<Notification[]>(`/shops/${shopId}/notifications`),
      );
      if (shop?.role === 'owner')
        setAudit(await api<Audit[]>(`/shops/${shopId}/audit`));
    } catch (e) {
      setError(errorText(e));
    }
  };

  useEffect(() => {
    void load();
  }, [shopId, shop?.role]);

  const markRead = async (item: Notification) => {
    if (item.readAt) return;
    try {
      await api(`/shops/${shopId}/notifications/${item.id}/read`, {
        method: 'POST',
      });
      await load();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">События магазина</p>
          <h1>Уведомления и аудит</h1>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="panel">
        <h2>Уведомления</h2>
        {!notifications.length && (
          <p className="muted">Новых событий пока нет.</p>
        )}
        <div className="stack">
          {notifications.map((item) => (
            <button
              type="button"
              className="notification-row"
              key={item.id}
              onClick={() => void markRead(item)}
            >
              <span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </span>
              <span>{item.readAt ? 'Прочитано' : 'Новое'}</span>
            </button>
          ))}
        </div>
      </div>
      {shop?.role === 'owner' && (
        <div className="panel">
          <h2>Журнал аудита</h2>
          {!audit.length && <p className="muted">Записей пока нет.</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Событие</th>
                  <th>Объект</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString('ru-RU')}</td>
                    <td>{item.action}</td>
                    <td>{item.entityType}</td>
                    <td>
                      <code>{JSON.stringify(item.details)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
