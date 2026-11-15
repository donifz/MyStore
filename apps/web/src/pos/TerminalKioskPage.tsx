import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatDate, formatSom } from '../api/money';
import type { Page, SaleDetail, SaleSummary } from '../api/types';
import { useSession } from '../auth/SessionProvider';
import type { TerminalJob, TerminalSettings } from './TerminalPage';
import { useCurrentShift } from './use-current-shift';
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

type KioskTab = 'terminal' | 'sales';

function shortCheckCode(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default function TerminalKioskPage() {
  const { shopId } = useParams();
  const session = useSession();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<KioskTab>('terminal');
  const [settings, setSettings] = useState<TerminalSettings | null>(null);
  const [currentJob, setCurrentJob] = useState<TerminalJob | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'listening' | 'paying' | 'printing' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [printedNotice, setPrintedNotice] = useState(false);

  const [salesRefresh, setSalesRefresh] = useState(0);
  const [shiftSales, setShiftSales] = useState<SaleSummary[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleDetails, setSaleDetails] = useState<Record<string, SaleDetail>>(
    {},
  );
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const shop = session.user?.shops.find((s) => s.id === shopId);
  const isOwner = shop?.role === 'owner';
  const shift = useCurrentShift(shopId ?? '', String(salesRefresh), isOwner);
  const activeShift =
    shift.current && 'id' in shift.current ? shift.current : null;

  // Load shop terminal settings
  useEffect(() => {
    if (!shopId) return;
    api<TerminalSettings>(`/shops/${shopId}/pos/terminal/settings`)
      .then((s) => setSettings(s))
      .catch((e) => setErrorMessage(errorText(e)));
  }, [shopId]);

  // Load sales for the active shift
  useEffect(() => {
    if (!shopId || !activeShift?.id) {
      setShiftSales([]);
      setSalesError('');
      return;
    }
    let alive = true;
    setSalesLoading(true);
    api<Page<SaleSummary>>(
      `/shops/${shopId}/pos/sales?shiftId=${activeShift.id}&pageSize=100&sort=newest`,
    )
      .then((res) => {
        if (alive) {
          setShiftSales(res.items);
          setSalesError('');
        }
      })
      .catch((e) => {
        if (alive) setSalesError(errorText(e));
      })
      .finally(() => {
        if (alive) setSalesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shopId, activeShift?.id, salesRefresh]);

  const toggleSaleDetail = useCallback(
    async (saleId: string) => {
      if (expandedSaleId === saleId) {
        setExpandedSaleId(null);
        return;
      }
      setExpandedSaleId(saleId);
      if (!shopId || saleDetails[saleId]) return;
      setDetailLoadingId(saleId);
      try {
        const detail = await api<SaleDetail>(
          `/shops/${shopId}/pos/sales/${saleId}`,
        );
        setSaleDetails((prev) => ({ ...prev, [saleId]: detail }));
      } catch {
        // leave empty on error
      } finally {
        setDetailLoadingId(null);
      }
    },
    [expandedSaleId, saleDetails, shopId],
  );

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
      setSalesRefresh((n) => n + 1);
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
            setActiveTab('terminal');
            for (const job of res.jobs) {
              setCurrentJob(job);
              if (job.payload.method === 'card') {
                setStatus('paying');
                // Give buyer time to see QR on screen, then print receipt
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
    navigate('/seller/login');
    return null;
  }

  const isCard = currentJob?.payload.method === 'card';
  const showQr =
    isCard && settings?.paymentQrData && settings?.showQrOnCheckout;

  const shiftCashTotal = shiftSales
    .filter((item) => item.method === 'cash')
    .reduce((sum, item) => sum + item.totalMinor, 0);
  const shiftCardTotal = shiftSales
    .filter((item) => item.method === 'card')
    .reduce((sum, item) => sum + item.totalMinor, 0);
  const shiftTotal = shiftSales.reduce((sum, item) => sum + item.totalMinor, 0);

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
            status === 'error' ? 'warn' : 'active'
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

      <nav
        className="terminal-kiosk__tabs no-print"
        aria-label="Режимы терминала"
      >
        <button
          type="button"
          className={`terminal-kiosk__tab ${
            activeTab === 'terminal' ? 'is-active' : ''
          }`}
          onClick={() => setActiveTab('terminal')}
        >
          Терминал
        </button>
        <button
          type="button"
          className={`terminal-kiosk__tab ${
            activeTab === 'sales' ? 'is-active' : ''
          }`}
          onClick={() => {
            setActiveTab('sales');
            setSalesRefresh((n) => n + 1);
          }}
        >
          Продажи смены
          {activeShift && shiftSales.length > 0 && (
            <span className="terminal-kiosk__tab-count">
              {shiftSales.length}
            </span>
          )}
        </button>
      </nav>

      {activeTab === 'terminal' ? (
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
                Проведите продажу на кассе — на этом экране появится сумма,
                QR-код и сразу напечатается квитанция.
              </p>
            </div>
          )}
        </main>
      ) : (
        <main className="terminal-kiosk__sales no-print">
          <div className="terminal-kiosk__sales-head">
            <div>
              <h2>Продажи текущей смены</h2>
              <p className="terminal-kiosk__sales-sub">
                {activeShift
                  ? `Смена открыта: ${formatDate(activeShift.openedAt)}`
                  : 'Открытой смены нет'}
              </p>
            </div>
            <button
              type="button"
              className="terminal-kiosk__refresh"
              onClick={() => setSalesRefresh((n) => n + 1)}
              disabled={salesLoading || shift.loading}
            >
              {salesLoading || shift.loading ? 'Загрузка...' : 'Обновить'}
            </button>
          </div>

          {(shift.error || salesError) && (
            <p className="error" style={{ marginBottom: '0.75rem' }}>
              {shift.error || salesError}
            </p>
          )}

          {shift.loading && !activeShift ? (
            <p className="terminal-kiosk__empty">Загрузка смены...</p>
          ) : !activeShift ? (
            <div className="terminal-kiosk__empty-card">
              <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>
                Смена ещё не открыта
              </p>
              <p className="terminal-kiosk__sales-sub" style={{ margin: 0 }}>
                Откройте смену на кассе, чтобы здесь отображались её продажи.
              </p>
            </div>
          ) : (
            <>
              <div className="terminal-kiosk__summary">
                <div className="terminal-kiosk__stat">
                  <span>Чеков</span>
                  <strong>{shiftSales.length}</strong>
                </div>
                <div className="terminal-kiosk__stat">
                  <span>Наличные</span>
                  <strong>{formatSom(shiftCashTotal)}</strong>
                </div>
                <div className="terminal-kiosk__stat">
                  <span>Карта / QR</span>
                  <strong>{formatSom(shiftCardTotal)}</strong>
                </div>
                <div className="terminal-kiosk__stat terminal-kiosk__stat--total">
                  <span>Итого</span>
                  <strong>{formatSom(shiftTotal)}</strong>
                </div>
              </div>

              {shiftSales.length === 0 ? (
                <div className="terminal-kiosk__empty-card">
                  <p style={{ margin: 0 }}>В этой смене продаж пока нет</p>
                </div>
              ) : (
                <ul className="terminal-kiosk__sale-list">
                  {shiftSales.map((sale) => {
                    const isExpanded = expandedSaleId === sale.id;
                    const detail = saleDetails[sale.id];
                    return (
                      <li key={sale.id} className="terminal-kiosk__sale-item">
                        <button
                          type="button"
                          className="terminal-kiosk__sale-row"
                          onClick={() => void toggleSaleDetail(sale.id)}
                        >
                          <div className="terminal-kiosk__sale-meta">
                            <strong>Чек #{shortCheckCode(sale.id)}</strong>
                            <span>
                              {formatDate(sale.createdAt)} ·{' '}
                              {sale.method === 'card'
                                ? 'Карта / QR'
                                : 'Наличные'}
                            </span>
                          </div>
                          <span className="terminal-kiosk__sale-amount">
                            {formatSom(sale.totalMinor)}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="terminal-kiosk__sale-detail">
                            {detailLoadingId === sale.id && !detail ? (
                              <span className="terminal-kiosk__sales-sub">
                                Загрузка позиций...
                              </span>
                            ) : detail && detail.lines.length > 0 ? (
                              detail.lines.map((line) => {
                                const lineSum =
                                  line.quantity * line.unitPriceMinor -
                                  (line.discountMinor || 0);
                                return (
                                  <div
                                    key={line.id}
                                    className="terminal-kiosk__sale-line"
                                  >
                                    <span>
                                      {line.name} × {line.quantity}
                                    </span>
                                    <span>{formatSom(lineSum)}</span>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="terminal-kiosk__sales-sub">
                                Нет позиций
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </main>
      )}

      <footer className="terminal-kiosk__footer no-print">
        <span>Встроенный принтер: {settings?.paperWidth || 58} мм</span>
        <span>Только терминал и продажи смены</span>
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
