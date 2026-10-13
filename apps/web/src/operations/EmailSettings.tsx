import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
import { useAccessOperation } from '../auth/use-access-operation';
type Status = {
  enabled: boolean;
  configured: boolean;
  provider: string;
  deliveries: {
    id: string;
    recipient: string;
    status: string;
    retryable: boolean;
    attempts: number;
    created_at: string;
    sent_at: string | null;
  }[];
};
export default function EmailSettings({
  shopId,
  owner,
}: {
  shopId: string;
  owner: boolean;
}) {
  const [prefs, setPrefs] = useState({ orders: true, moderation: true }),
    [status, setStatus] = useState<Status | null>(null),
    [error, setError] = useState('');
  const op = useAccessOperation();
  const base = '/shops/' + shopId + '/email';
  async function load() {
    try {
      setPrefs(await api(base + '/preferences'));
      if (owner) setStatus(await api(base + '/status'));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }
  useEffect(() => {
    void load();
  }, [shopId, owner]);
  return (
    <div className="panel">
      <h2>Email-уведомления</h2>
      <p className="muted">
        Настройки относятся к вашей почте. Внутренние уведомления продолжают
        работать.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await op.run(base + '/preferences', prefs)) await load();
        }}
      >
        <fieldset disabled={op.busy || op.pending}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={prefs.orders}
              onChange={(e) => setPrefs({ ...prefs, orders: e.target.checked })}
            />
            Новые заказы
          </label>
          {owner && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={prefs.moderation}
                onChange={(e) =>
                  setPrefs({ ...prefs, moderation: e.target.checked })
                }
              />
              Решения модерации
            </label>
          )}
          <button disabled={op.busy}>Сохранить настройки</button>
        </fieldset>
      </form>
      {op.success && <p role="status">Сохранено.</p>}
      {(error || op.error) && (
        <p role="alert" className="error">
          {error || op.error}
        </p>
      )}
      {op.pending && (
        <button
          disabled={op.busy}
          onClick={async () => {
            if (await op.retry()) await load();
          }}
        >
          Повторить операцию
        </button>
      )}
      {owner && status && (
        <>
          <p role="status">
            {status.configured
              ? status.provider === 'gmail'
                ? 'Gmail настроен. Принятое письмо ещё не означает доставку во входящие.'
                : 'SMTP настроен. Статус «Принято SMTP» означает приём почтовым сервером, а не доставку во входящие.'
              : 'Отправка почты не настроена или отключена. Подключите Gmail API или SMTP.'}
          </p>
          <h3>Последние отправки</h3>
          {!status.deliveries.length ? (
            <p className="muted">Отправок пока нет.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Получатель</th>
                    <th>Статус</th>
                    <th>Попытки</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {status.deliveries.map((d) => (
                    <tr key={d.id}>
                      <td>{d.recipient}</td>
                      <td>
                        {{
                          sent:
                            status.provider === 'gmail'
                              ? 'Принято Gmail'
                              : 'Принято SMTP',
                          pending: 'В очереди',
                          sending: 'Отправляется',
                          failed: 'Ошибка отправки',
                          cancelled: 'Отменено',
                        }[d.status] || d.status}
                      </td>
                      <td>{d.attempts}</td>
                      <td>
                        {d.status === 'failed' && d.retryable && (
                          <button
                            disabled={op.busy || op.pending}
                            onClick={async () => {
                              if (
                                window.confirm(
                                  'Повторить отправку? Для приглашений с истёкшей ссылкой нужно выслать новое приглашение.',
                                )
                              ) {
                                if (
                                  await op.run(
                                    base + '/deliveries/' + d.id + '/retry',
                                    {},
                                  )
                                )
                                  await load();
                              }
                            }}
                          >
                            Повторить отправку
                          </button>
                        )}
                        {d.status === 'failed' && !d.retryable && (
                          <span className="muted">
                            Выдайте новое приглашение или запросите
                            восстановление заново.
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            type="button"
            disabled={op.busy || op.pending}
            onClick={() => void load()}
          >
            Обновить отправки
          </button>
        </>
      )}
    </div>
  );
}
