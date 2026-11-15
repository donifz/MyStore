import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatDate, formatSom } from '../api/money';
import { useSession } from '../auth/SessionProvider';
import { InstallApp } from '../pwa/InstallApp';
import './terminal.css';

export type TerminalSettings = {
  paymentQrData: string | null;
  paymentQrLabel: string;
  showQrOnCheckout: boolean;
  printQrOnReceipt: boolean;
  paperWidth: 58 | 80;
  autoPrint: boolean;
  receiptHeader: string;
  receiptFooter: string;
};

export type TerminalJob = {
  id: string;
  shopId: string;
  saleId: string | null;
  kind: 'receipt' | 'test';
  status: 'pending' | 'printed' | 'failed';
  payload: {
    shopName?: string;
    method?: string;
    totalMinor?: number;
    createdAt?: string;
    lines?: Array<{
      name: string;
      quantity: number;
      unitPriceMinor: number;
      discountMinor?: number;
    }>;
  };
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type FiscalStatus = {
  configured: boolean;
  provider?: string;
  mode?: string;
  message?: string;
};

const DEFAULT_SETTINGS: TerminalSettings = {
  paymentQrData: null,
  paymentQrLabel: 'Оплата по QR',
  showQrOnCheckout: true,
  printQrOnReceipt: false,
  paperWidth: 58,
  autoPrint: true,
  receiptHeader: '',
  receiptFooter: 'Спасибо за покупку!',
};

async function compressQrImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 512;
      const scale = Math.min(1, max / Math.max(img.width, img.height, 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function TerminalPage() {
  const { shopId } = useParams();
  const session = useSession();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  const canEdit = shop?.role === 'owner' || shop?.role === 'manager';

  const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS);
  const [jobs, setJobs] = useState<TerminalJob[]>([]);
  const [fiscal, setFiscal] = useState<FiscalStatus | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<TerminalJob | null>(null);
  const [listening, setListening] = useState(false);
  const [pollError, setPollError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const loadData = useCallback(async () => {
    if (!shopId) return;
    try {
      const [s, j] = await Promise.all([
        api<TerminalSettings>(`/shops/${shopId}/pos/terminal/settings`),
        api<TerminalJob[]>(`/shops/${shopId}/pos/terminal/jobs`),
      ]);
      setSettings(s);
      setJobs(j);
      if (j.length > 0) {
        setActiveReceipt((prev) => prev ?? j[0]);
      }
    } catch (e) {
      setError(errorText(e));
    }
    api<FiscalStatus>(`/shops/${shopId}/fiscal/status`)
      .then((f) => setFiscal(f))
      .catch(() => setFiscal(null));
  }, [shopId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const printJob = useCallback(
    async (job: TerminalJob, ackAfter = false) => {
      setActiveReceipt(job);
      setTimeout(() => {
        window.print();
      }, 60);
      if (ackAfter && shopId) {
        try {
          await api(`/shops/${shopId}/pos/terminal/jobs/${job.id}/ack`, {
            method: 'POST',
            body: { status: 'printed' },
          });
          const updated = await api<TerminalJob[]>(
            `/shops/${shopId}/pos/terminal/jobs`,
          );
          setJobs(updated);
        } catch {
          // ignore ack error in background
        }
      }
    },
    [shopId],
  );

  useEffect(() => {
    if (!listening || !shopId) return;
    let active = true;
    const controller = new AbortController();

    async function loop() {
      while (active) {
        try {
          setPollError('');
          const res = await api<{ jobs: TerminalJob[] }>(
            `/shops/${shopId}/pos/terminal/poll`,
            { signal: controller.signal },
          );
          if (!active) break;
          if (res.jobs.length > 0) {
            for (const job of res.jobs) {
              setActiveReceipt(job);
              if (settingsRef.current.autoPrint) {
                await printJob(job, true);
              } else {
                await api(`/shops/${shopId}/pos/terminal/jobs/${job.id}/ack`, {
                  method: 'POST',
                  body: { status: 'printed' },
                });
              }
            }
            const refreshed = await api<TerminalJob[]>(
              `/shops/${shopId}/pos/terminal/jobs`,
            );
            if (active) setJobs(refreshed);
          }
        } catch (e) {
          if (!active) break;
          setPollError(errorText(e));
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    }

    void loop();
    return () => {
      active = false;
      controller.abort();
    };
  }, [listening, shopId, printJob]);

  async function handleQrUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const compressed = await compressQrImage(file);
      setSettings((prev) => ({ ...prev, paymentQrData: compressed }));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleSave() {
    if (!shopId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await api<TerminalSettings>(
        `/shops/${shopId}/pos/terminal/settings`,
        {
          method: 'PUT',
          body: settings,
        },
      );
      setSettings(saved);
      setNotice('Настройки терминала сохранены');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestPrint() {
    if (!shopId) return;
    setTesting(true);
    setError('');
    setNotice('');
    try {
      const job = await api<TerminalJob>(
        `/shops/${shopId}/pos/terminal/test-print`,
        { method: 'POST' },
      );
      setJobs((prev) => [job, ...prev]);
      await printJob(job, !listening);
      setNotice('Тестовый чек отправлен на печать');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">ККМ и печать</p>
          <h1>Терминал и ККМ</h1>
        </div>
        <InstallApp />
      </div>

      {error && (
        <p className="error no-print" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-kit-status no-print" role="status">
          {notice}
        </p>
      )}

      <div className="terminal-grid no-print">
        <section className="panel terminal-card">
          <div className="terminal-status-row">
            <h2>Приём чеков (Long Polling)</h2>
            <span
              className={`terminal-badge ${
                listening
                  ? pollError
                    ? 'terminal-badge--warn'
                    : 'terminal-badge--active'
                  : ''
              }`}
            >
              <span className="terminal-dot" aria-hidden="true" />
              {listening
                ? pollError
                  ? 'Переподключение...'
                  : 'Слушает очередь'
                : 'Остановлен'}
            </span>
          </div>
          <p className="muted">
            Откройте эту страницу на POS-терминале или компьютере с принтером
            чеков, войдите под своим логином и запустите приём — новые продажи
            будут автоматически приходить и печататься.
          </p>
          {pollError && <p className="error">{pollError}</p>}
          <div className="terminal-actions">
            <button
              type="button"
              className={listening ? 'secondary' : 'primary'}
              onClick={() => setListening((v) => !v)}
            >
              {listening ? 'Остановить приём' : 'Запустить приём чеков'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={testing}
              onClick={() => void handleTestPrint()}
            >
              {testing ? 'Отправка...' : 'Тестовая печать'}
            </button>
          </div>
        </section>

        <section className="panel terminal-card">
          <div className="terminal-status-row">
            <h2>Статус ККМ и фискализации</h2>
            <span
              className={`terminal-badge ${
                fiscal?.configured ? 'terminal-badge--active' : ''
              }`}
            >
              {fiscal?.configured ? 'Подключена' : 'Не подключена'}
            </span>
          </div>
          <p className="muted">
            {fiscal?.configured
              ? `Провайдер: ${fiscal.provider || 'ККМ'} (${fiscal.mode || 'рабочий'})`
              : fiscal?.message ||
                'Внешний фискальный регистратор не настроен. Печатаются нефискальные товарные чеки и QR-оплата.'}
          </p>
        </section>

        <section className="panel terminal-card">
          <h2>QR для оплаты</h2>
          {settings.paymentQrData ? (
            <div className="terminal-qr-preview">
              <img src={settings.paymentQrData} alt="QR оплаты" />
              <div>
                <strong>{settings.paymentQrLabel}</strong>
                {canEdit && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          paymentQrData: null,
                        }))
                      }
                    >
                      Удалить QR
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="muted">QR-код оплаты ещё не загружен.</p>
          )}
          {canEdit && (
            <label className="terminal-field">
              <span>Загрузить изображение QR</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleQrUpload(e)}
              />
            </label>
          )}
          <label className="terminal-field">
            <span>Подпись QR</span>
            <input
              type="text"
              value={settings.paymentQrLabel}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  paymentQrLabel: e.target.value,
                }))
              }
            />
          </label>
          <label className="terminal-check">
            <input
              type="checkbox"
              checked={settings.showQrOnCheckout}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  showQrOnCheckout: e.target.checked,
                }))
              }
            />
            <span>Показывать QR на экране оплаты в кассе</span>
          </label>
          <label className="terminal-check">
            <input
              type="checkbox"
              checked={settings.printQrOnReceipt}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  printQrOnReceipt: e.target.checked,
                }))
              }
            />
            <span>Печатать QR на бумажном чеке</span>
          </label>
        </section>

        <section className="panel terminal-card">
          <h2>Настройки печати</h2>
          <label className="terminal-field">
            <span>Ширина ленты</span>
            <select
              value={settings.paperWidth}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  paperWidth: Number(e.target.value) === 80 ? 80 : 58,
                }))
              }
            >
              <option value={58}>58 мм (мобильный POS / ККМ)</option>
              <option value={80}>80 мм (стационарный принтер)</option>
            </select>
          </label>
          <label className="terminal-check">
            <input
              type="checkbox"
              checked={settings.autoPrint}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  autoPrint: e.target.checked,
                }))
              }
            />
            <span>Автоматически печатать новые чеки</span>
          </label>
          <label className="terminal-field">
            <span>Шапка чека</span>
            <input
              type="text"
              placeholder="Например: ул. Киевская 10, тел. +996..."
              value={settings.receiptHeader}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  receiptHeader: e.target.value,
                }))
              }
            />
          </label>
          <label className="terminal-field">
            <span>Подвал чека</span>
            <input
              type="text"
              placeholder="Спасибо за покупку!"
              value={settings.receiptFooter}
              disabled={!canEdit}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  receiptFooter: e.target.value,
                }))
              }
            />
          </label>
          {canEdit && (
            <div className="terminal-actions">
              <button
                type="button"
                className="primary"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="panel no-print" style={{ marginTop: '1rem' }}>
        <div
          className="terminal-status-row"
          style={{ marginBottom: '0.75rem' }}
        >
          <h2>Очередь и последние чеки</h2>
          <button
            type="button"
            className="secondary"
            onClick={() => void loadData()}
          >
            Обновить
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="muted">Чеков в очереди пока нет.</p>
        ) : (
          <div className="terminal-jobs-list">
            {jobs.map((job) => (
              <div key={job.id} className="terminal-job-row">
                <div className="terminal-job-meta">
                  <strong>
                    {job.kind === 'test' ? 'Тестовый чек' : 'Чек продажи'} ·{' '}
                    {formatSom(job.payload.totalMinor ?? 0)}
                  </strong>
                  <span className="muted">
                    {formatDate(job.createdAt)} ·{' '}
                    {job.status === 'printed'
                      ? 'Напечатан'
                      : job.status === 'failed'
                        ? 'Ошибка'
                        : 'Ожидает печати'}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void printJob(job, job.status === 'pending')}
                >
                  Печать
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {activeReceipt && (
        <div
          className={`terminal-print-receipt terminal-print-receipt--${settings.paperWidth}`}
        >
          <div style={{ textAlign: 'center', fontWeight: 700 }}>
            {activeReceipt.payload.shopName || shop?.name || 'MyStore'}
          </div>
          {settings.receiptHeader && (
            <div style={{ textAlign: 'center', marginTop: '2px' }}>
              {settings.receiptHeader}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            {formatDate(
              activeReceipt.payload.createdAt || activeReceipt.createdAt,
            )}
          </div>
          <div className="terminal-receipt-divider" />
          {(activeReceipt.payload.lines ?? []).map((line, i) => {
            const lineSum =
              line.quantity * line.unitPriceMinor - (line.discountMinor || 0);
            return (
              <div key={i} style={{ marginBottom: '4px' }}>
                <div>
                  {i + 1}. {line.name}
                </div>
                <div className="terminal-receipt-row">
                  <span>
                    {line.quantity} × {formatSom(line.unitPriceMinor)}
                  </span>
                  <span>{formatSom(lineSum)}</span>
                </div>
              </div>
            );
          })}
          <div className="terminal-receipt-divider" />
          <div className="terminal-receipt-row" style={{ fontWeight: 700 }}>
            <span>ИТОГО:</span>
            <span>{formatSom(activeReceipt.payload.totalMinor ?? 0)}</span>
          </div>
          <div className="terminal-receipt-row">
            <span>Оплата:</span>
            <span>
              {activeReceipt.payload.method === 'card'
                ? 'Безналичные / QR'
                : 'Наличные'}
            </span>
          </div>
          {activeReceipt.payload.method === 'card' &&
            settings.printQrOnReceipt &&
            settings.paymentQrData && (
              <>
                <div className="terminal-receipt-divider" />
                <img
                  className="terminal-receipt-qr"
                  src={settings.paymentQrData}
                  alt={settings.paymentQrLabel}
                />
                <div style={{ textAlign: 'center' }}>
                  {settings.paymentQrLabel}
                </div>
              </>
            )}
          {settings.receiptFooter && (
            <>
              <div className="terminal-receipt-divider" />
              <div style={{ textAlign: 'center' }}>
                {settings.receiptFooter}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
