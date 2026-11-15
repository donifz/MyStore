import { useCallback, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatDate, formatSom } from '../api/money';
import { useSession } from '../auth/SessionProvider';
import type { TerminalJob, TerminalSettings } from './TerminalPage';
import './terminal.css';
import './terminal-kiosk.css';

// Interface exposed by native Android APK via JavascriptInterface
declare global {
  interface Window {
    AndroidPrinter?: {
      printEscPosReceipt?: (jsonPayload: string) => boolean;
      isAvailable?: () => boolean;
    };
  }
}

export default function TerminalKioskPage() {
  const { shopId } = useParams();
  const session = useSession();

  const [settings, setSettings] = useState<TerminalSettings | null>(null);
  const [currentJob, setCurrentJob] = useState<TerminalJob | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'listening' | 'paying' | 'printing' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [printedNotice, setPrintedNotice] = useState(false);

  const shop = session.user?.shops.find((s) => s.id === shopId);

  // Load shop terminal settings
  useEffect(() => {
    if (!shopId) return;
    api<TerminalSettings>(`/shops/${shopId}/pos/terminal/settings`)
      .then((s) => setSettings(s))
      .catch((e) => setErrorMessage(errorText(e)));
  }, [shopId]);

  // Execute print (Native Android direct silent print or fallback window.print)
  const triggerPrint = useCallback(
    async (job: TerminalJob) => {
      setStatus('printing');

      // 1. Try Native Android APK silent print interface
      let silentSuccess = false;
      if (
        window.AndroidPrinter &&
        typeof window.AndroidPrinter.printEscPosReceipt === 'function'
      ) {
        try {
          silentSuccess = window.AndroidPrinter.printEscPosReceipt(
            JSON.stringify({
              shopName: job.payload.shopName || shop?.name || 'MyStore',
              method: job.payload.method || 'cash',
              totalMinor: job.payload.totalMinor || 0,
              createdAt: job.payload.createdAt || job.createdAt,
              lines: job.payload.lines || [],
              paperWidth: settings?.paperWidth || 58,
              receiptHeader: settings?.receiptHeader || '',
              receiptFooter: settings?.receiptFooter || 'Спасибо за покупку!',
            }),
          );
        } catch {
          silentSuccess = false;
        }
      }

      // 2. Fallback to standard window.print() if not inside native APK
      if (!silentSuccess) {
        window.print();
      }

      // Acknowledge job to backend
      if (shopId) {
        try {
          await api(`/shops/${shopId}/pos/terminal/jobs/${job.id}/ack`, {
            method: 'POST',
            body: { status: 'printed' },
          });
        } catch {
          // ack background error ignored
        }
      }

      setPrintedNotice(true);
      setTimeout(() => {
        setPrintedNotice(false);
        setCurrentJob(null);
        setStatus('listening');
      }, 4500);
    },
    [shopId, shop?.name, settings],
  );

  // Long Polling receipt queue loop
  useEffect(() => {
    if (!shopId) return;
    let active = true;
    const controller = new AbortController();

    async function pollLoop() {
      setStatus('listening');
      while (active) {
        try {
          setErrorMessage('');
          const res = await api<{ jobs: TerminalJob[] }>(
            `/shops/${shopId}/pos/terminal/poll`,
            { signal: controller.signal },
          );
          if (!active) break;
          if (res.jobs.length > 0) {
            for (const job of res.jobs) {
              setCurrentJob(job);
              if (job.payload.method === 'card') {
                setStatus('paying');
                // Give buyer 12 seconds to see QR on screen, then print receipt
                await new Promise((r) => setTimeout(r, 6000));
              }
              await triggerPrint(job);
            }
          }
        } catch (e) {
          if (!active) break;
          setStatus('error');
          setErrorMessage(errorText(e));
          await new Promise((r) => setTimeout(r, 3000));
          if (active) setStatus('listening');
        }
      }
    }

    void pollLoop();
    return () => {
      active = false;
      controller.abort();
    };
  }, [shopId, triggerPrint]);

  if (session.loading) {
    return (
      <div className="terminal-kiosk">
        <p className="loading">Подключение к терминалу...</p>
      </div>
    );
  }

  if (!session.user) {
    return (
      <Navigate
        to="/seller/login"
        state={{ from: shopId ? `/terminal/${shopId}` : '/terminal' }}
        replace
      />
    );
  }

  if (!shopId) {
    const firstShop = session.user.shops[0];
    if (firstShop) {
      return <Navigate to={`/terminal/${firstShop.id}`} replace />;
    }
    return (
      <div className="terminal-kiosk">
        <main className="terminal-kiosk__main">
          <p className="error">Нет доступных магазинов для терминала.</p>
        </main>
      </div>
    );
  }

  const isCard = currentJob?.payload.method === 'card';
  const showQr =
    isCard && settings?.paymentQrData && settings?.showQrOnCheckout;

  return (
    <div className="terminal-kiosk">
      <header className="terminal-kiosk__header no-print">
        <div className="terminal-kiosk__brand">
          <span>MyStore POS</span>
          <span style={{ color: '#64748b', fontWeight: 400 }}>·</span>
          <span>{shop?.name || 'Касса'}</span>
        </div>
        <div
          className={`terminal-kiosk__status ${
            status === 'listening'
              ? 'active'
              : status === 'error'
                ? 'warn'
                : 'active'
          }`}
        >
          <span className="terminal-dot" aria-hidden="true" />
          {status === 'paying'
            ? 'Оплата...'
            : status === 'printing'
              ? 'Печать...'
              : status === 'error'
                ? 'Связь...'
                : 'Готов к оплате'}
        </div>
      </header>

      <main className="terminal-kiosk__main no-print">
        {errorMessage && (
          <p className="error" style={{ marginBottom: '1rem' }}>
            {errorMessage}
          </p>
        )}

        {currentJob ? (
          <div className="terminal-kiosk__amount-card">
            <span className="terminal-kiosk__amount-label">
              {isCard ? 'Оплата через QR / Карта' : 'Оплата наличными'}
            </span>
            <span className="terminal-kiosk__amount-value">
              {formatSom(currentJob.payload.totalMinor || 0)}
            </span>

            {showQr && (
              <div className="terminal-kiosk__qr-wrapper">
                <img
                  src={settings!.paymentQrData!}
                  alt={settings?.paymentQrLabel || 'QR для оплаты'}
                />
              </div>
            )}

            {printedNotice && (
              <p
                style={{
                  color: '#34d399',
                  fontWeight: 600,
                  margin: '0.5rem 0 0',
                }}
              >
                Чек напечатан!
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <svg
              className="terminal-kiosk__idle-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="12" y2="12" />
              <line x1="7" y1="16" x2="10" y2="16" />
            </svg>
            <h2 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem' }}>
              Ожидание продажи
            </h2>
            <p className="muted" style={{ maxWidth: '300px', margin: 0 }}>
              Проведите продажу на кассе — на этом экране появится сумма, QR-код
              и сразу напечатается квитанция.
            </p>
          </div>
        )}
      </main>

      <footer className="terminal-kiosk__footer no-print">
        <span>Встроенный принтер: {settings?.paperWidth || 58} мм</span>
        <span>Только терминал</span>
      </footer>

      {/* Hidden thermal print receipt container for window.print() fallback */}
      {currentJob && (
        <div
          className={`terminal-print-receipt terminal-print-receipt--${settings?.paperWidth || 58}`}
        >
          <div style={{ textAlign: 'center', fontWeight: 700 }}>
            {currentJob.payload.shopName || shop?.name || 'MyStore'}
          </div>
          {settings?.receiptHeader && (
            <div style={{ textAlign: 'center', marginTop: '2px' }}>
              {settings.receiptHeader}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '2px' }}>
            {formatDate(currentJob.payload.createdAt || currentJob.createdAt)}
          </div>
          <div className="terminal-receipt-divider" />
          {(currentJob.payload.lines ?? []).map((line, i) => {
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
            <span>{formatSom(currentJob.payload.totalMinor ?? 0)}</span>
          </div>
          <div className="terminal-receipt-row">
            <span>Оплата:</span>
            <span>{isCard ? 'Безналичные / QR' : 'Наличные'}</span>
          </div>
          {settings?.receiptFooter && (
            <>
              <div className="terminal-receipt-divider" />
              <div style={{ textAlign: 'center' }}>
                {settings.receiptFooter}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
