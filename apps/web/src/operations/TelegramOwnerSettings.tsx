import { useEffect, useState } from 'react';
import { api, errorText } from '../api/client';
import BuyerInviteQr from '../customers/BuyerInviteQr';

type TelegramStatus = {
  enabled: boolean;
  botUsername: string | null;
  subscription: {
    chatId: string;
    telegramUserId: string | null;
    username: string | null;
    firstName: string | null;
    dailyShiftSummary: boolean;
    createdAt: string;
  } | null;
};

export default function TelegramOwnerSettings({
  shopId,
  owner,
}: {
  shopId: string;
  owner: boolean;
}) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Link token modal/view
  const [linkUrl, setLinkUrl] = useState('');
  const [linking, setLinking] = useState(false);

  // Manual chat ID input
  const [manualOpen, setManualOpen] = useState(false);
  const [manualChatId, setManualChatId] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  // Test send busy state
  const [testingBusy, setTestingBusy] = useState(false);

  const base = `/shops/${shopId}/telegram`;

  async function load() {
    if (!owner) return;
    setLoading(true);
    try {
      const data = await api<TelegramStatus>(`${base}/status`);
      setStatus(data);
      setError('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [shopId, owner]);

  // Poll for connection while linkUrl is open and not connected yet
  useEffect(() => {
    if (!linkUrl || status?.subscription) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await api<TelegramStatus>(`${base}/status`);
        if (fresh.subscription) {
          setStatus(fresh);
          setLinkUrl('');
          setNotice('Telegram успешно подключён!');
        }
      } catch {
        // quiet poll
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [linkUrl, status?.subscription, base]);

  async function startConnect() {
    setError('');
    setNotice('');
    setLinking(true);
    try {
      const res = await api<{ url: string; expiresIn: number }>(
        `${base}/link-token`,
        { method: 'POST' },
      );
      setLinkUrl(res.url);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLinking(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualChatId.trim()) return;
    setManualBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`${base}/manual-subscribe`, {
        method: 'POST',
        body: { chatId: manualChatId.trim() },
      });
      setNotice('Чат успешно сохранён и подключён!');
      setManualOpen(false);
      setManualChatId('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setManualBusy(false);
    }
  }

  async function handleSendTest() {
    setTestingBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`${base}/test-summary`, { method: 'POST' });
      setNotice('Тестовая сводка успешно отправлена в Telegram!');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setTestingBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Отключить получение ежедневных отчётов в Telegram?')) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await api(`${base}/subscription`, { method: 'DELETE' });
      setNotice('Telegram отключён.');
      setLinkUrl('');
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  if (!owner) return null;

  return (
    <div className="panel telegram-owner-settings-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2AABEE 0%, #229ED9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
            Telegram-сводка для владельца (Закрытие смены)
          </h2>
          <p
            className="muted"
            style={{ margin: '2px 0 0', fontSize: '0.85rem' }}
          >
            Моментальный ежедневный отчёт в Telegram при закрытии кассы
          </p>
        </div>
      </div>

      <p
        className="muted"
        style={{ margin: '14px 0 16px', fontSize: '0.9rem' }}
      >
        При каждом закрытии кассовой смены бот отправляет структурированный
        отчёт: <b>выручка</b> (наличные / безнал), <b>чистая прибыль</b>,{' '}
        <b>расходы по статьям</b>, <b>фактический остаток в кассе</b> и{' '}
        <b>топ-5 проданных товаров</b>.
      </p>

      {notice && (
        <p
          role="status"
          style={{ color: 'var(--success-color, #15803d)', fontWeight: 500 }}
        >
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {status && !status.enabled && (
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--bg-muted, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '8px',
            fontSize: '0.875rem',
          }}
        >
          ℹ️ Telegram-бот пока не активирован на сервере (отсутствуют переменные{' '}
          <code>TELEGRAM_BOT_TOKEN</code> и <code>TELEGRAM_BOT_USERNAME</code>).
        </div>
      )}

      {status?.enabled && (
        <>
          {status.subscription ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#15803d',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#16a34a',
                        display: 'inline-block',
                      }}
                    />
                    Подключено к Telegram
                  </span>
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary, #475569)',
                    }}
                  >
                    {status.subscription.username
                      ? `@${status.subscription.username}`
                      : status.subscription.firstName
                        ? status.subscription.firstName
                        : 'Чат'}{' '}
                    (ID: {status.subscription.chatId})
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleSendTest()}
                    disabled={testingBusy || loading}
                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  >
                    {testingBusy ? 'Отправка...' : 'Отправить тест'}
                  </button>
                  <button
                    type="button"
                    className="secondary danger"
                    onClick={() => void handleDisconnect()}
                    disabled={loading}
                    style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  >
                    Отключить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              {!linkUrl ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void startConnect()}
                    disabled={linking || loading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 2L11 13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {linking ? 'Генерация ссылки...' : 'Подключить Telegram'}
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setManualOpen(!manualOpen)}
                    style={{ fontSize: '0.85rem' }}
                  >
                    {manualOpen
                      ? 'Скрыть ручной ввод'
                      : 'Указать Chat ID вручную'}
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--bg-muted, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}
                  >
                    Отсканируйте QR-код или нажмите кнопку для подключения в
                    Telegram:
                  </p>

                  <div
                    style={{
                      background: '#fff',
                      padding: '10px',
                      borderRadius: '8px',
                    }}
                  >
                    <BuyerInviteQr value={linkUrl} />
                  </div>

                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button primary"
                    style={{
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 18px',
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M22 2L11 13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    Открыть Telegram-бота (@{status.botUsername})
                  </a>

                  <p
                    className="muted"
                    style={{ margin: 0, fontSize: '0.8rem' }}
                  >
                    После нажатия «Запустить» (Start) в Telegram чат подключится
                    автоматически.
                  </p>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setLinkUrl('')}
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    Отмена
                  </button>
                </div>
              )}

              {manualOpen && (
                <form
                  onSubmit={(e) => void handleManualSubmit(e)}
                  style={{
                    padding: '14px',
                    background: 'var(--bg-muted, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    Telegram Chat ID:
                    <input
                      type="text"
                      value={manualChatId}
                      onChange={(e) => setManualChatId(e.target.value)}
                      placeholder="Например: 123456789 или -1001234567890 для группы"
                      disabled={manualBusy}
                      style={{ marginTop: '4px', width: '100%' }}
                    />
                  </label>
                  <p
                    className="muted"
                    style={{ margin: 0, fontSize: '0.8rem' }}
                  >
                    Узнать свой Chat ID можно у бота <code>@userinfobot</code>.
                    Для каналов/групп добавьте бота в группу администратором.
                  </p>
                  <div>
                    <button
                      type="submit"
                      className="primary"
                      disabled={manualBusy || !manualChatId.trim()}
                      style={{ fontSize: '0.85rem' }}
                    >
                      {manualBusy ? 'Сохранение...' : 'Сохранить Chat ID'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
