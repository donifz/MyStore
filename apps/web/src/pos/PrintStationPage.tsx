import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { formatDate, formatSom } from '../api/money';
import { useShopLiveSync } from '../api/use-shop-live-sync';
import BarcodeLabel, {
  LabelPrintPage,
  LabelSize,
  normalizeLabelCopies,
} from '../catalog/BarcodeLabel';

export type PrintJob = {
  id: string;
  shopId: string;
  kind: 'label' | 'receipt';
  status: 'pending' | 'printing' | 'printed' | 'failed';
  payload: Record<string, any>;
  error: string | null;
  createdAt: string;
  printedAt: string | null;
};

const LOCAL_AGENT_URL = 'http://127.0.0.1:9191';

function statusLabel(status: PrintJob['status']) {
  switch (status) {
    case 'pending':
      return 'Ожидает печати';
    case 'printing':
      return 'Печатается…';
    case 'printed':
      return 'Напечатано';
    case 'failed':
      return 'Ошибка';
  }
}

export default function PrintStationPage() {
  const { shopId } = useParams();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoPrint, setAutoPrint] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [activeJob, setActiveJob] = useState<PrintJob | null>(null);
  const [tick, setTick] = useState(0);
  const busyJobRef = useRef(false);

  const loadJobs = useCallback(async () => {
    if (!shopId) return;
    try {
      const res = await api<{ items: PrintJob[] }>(
        `/shops/${shopId}/print-jobs?limit=40`,
      );
      setJobs(res.items);
      setError('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs, tick]);

  useShopLiveSync(shopId, ['print-job'], () => setTick((n) => n + 1));

  useEffect(() => {
    let alive = true;
    const checkAgent = async () => {
      try {
        const res = await fetch(`${LOCAL_AGENT_URL}/health`, {
          method: 'GET',
        });
        if (alive) setAgentOnline(res.ok);
      } catch {
        if (alive) setAgentOnline(false);
      }
    };
    void checkAgent();
    const timer = window.setInterval(checkAgent, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setInterval(() => {
      setTick((n) => n + 1);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [autoPrint]);

  const executePrint = useCallback(
    async (job: PrintJob) => {
      if (!shopId || busyJobRef.current) return;
      busyJobRef.current = true;
      try {
        const claimed = await api<PrintJob>(
          `/shops/${shopId}/print-jobs/${job.id}/claim`,
          { method: 'POST', body: {} },
        );
        setActiveJob(claimed);

        if (agentOnline) {
          const agentRes = await fetch(`${LOCAL_AGENT_URL}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: claimed.kind,
              payload: claimed.payload,
            }),
          });
          if (!agentRes.ok) {
            const text = await agentRes.text();
            throw new Error(text || 'Локальный принтер не ответил');
          }
        } else {
          await new Promise<void>((resolve) => {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                window.print();
                resolve();
              });
            });
          });
        }

        await api(`/shops/${shopId}/print-jobs/${claimed.id}/complete`, {
          method: 'POST',
          body: {},
        });
      } catch (err) {
        const msg = errorText(err);
        setError(msg);
        try {
          await api(`/shops/${shopId}/print-jobs/${job.id}/fail`, {
            method: 'POST',
            body: { error: msg },
          });
        } catch {
          // ignore secondary fail error
        }
      } finally {
        busyJobRef.current = false;
        setTick((n) => n + 1);
      }
    },
    [shopId, agentOnline],
  );

  useEffect(() => {
    if (!autoPrint || busyJobRef.current) return;
    const nextPending = jobs.find((j) => j.status === 'pending');
    if (nextPending) {
      void executePrint(nextPending);
    }
  }, [autoPrint, jobs, executePrint]);

  async function removeJob(jobId: string) {
    if (!shopId) return;
    try {
      await api(`/shops/${shopId}/print-jobs/${jobId}`, { method: 'DELETE' });
      setTick((n) => n + 1);
    } catch (err) {
      setError(errorText(err));
    }
  }

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;

  return (
    <>
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">Очередь печати</p>
          <h1>Станция печати</h1>
          <p className="muted">
            Откройте эту страницу на ноутбуке с термопринтером — задания с
            телефона появятся здесь автоматически.
          </p>
        </div>
        <div className="order-actions" style={{ gap: '0.5rem' }}>
          <button
            type="button"
            className={autoPrint ? 'primary button' : 'secondary button'}
            onClick={() => setAutoPrint((v) => !v)}
          >
            {autoPrint ? 'Автопечать: ВКЛ' : 'Включить автопечать'}
          </button>
          <button
            type="button"
            className="secondary button"
            onClick={() => setTick((n) => n + 1)}
          >
            Обновить
          </button>
        </div>
      </div>

      <section className="panel no-print" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div>
            <strong>
              USB-агент на ноутбуке:{' '}
              <span style={{ color: agentOnline ? '#145c43' : '#64748b' }}>
                {agentOnline
                  ? 'подключён (тихая печать)'
                  : 'не запущен (печать через браузер)'}
              </span>
            </strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Для прямой тихой печати на USB-термопринтер без диалоговых окон
              запустите на ноутбуке: <code>node scripts/print-agent.mjs</code>
            </p>
          </div>
          <span className="catalog-count-pill">В очереди: {pendingCount}</span>
        </div>
      </section>

      {error && (
        <p role="alert" className="error no-print">
          {error}
        </p>
      )}

      <section className="panel no-print">
        {loading ? (
          <p>Загрузка очереди…</p>
        ) : !jobs.length ? (
          <p className="empty-state">
            Очередь печати пуста. Нажмите «Отправить на принтер» с телефона в
            товарах или на кассе.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Содержимое</th>
                  <th>Статус</th>
                  <th>Создано</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const items = Array.isArray(job.payload?.items)
                    ? job.payload.items
                    : [];
                  const summary =
                    job.kind === 'label'
                      ? items.length
                        ? items
                            .map(
                              (item: any) =>
                                `${item.name} × ${item.copies ?? 1}`,
                            )
                            .join(', ')
                        : job.payload?.name || 'Этикетка'
                      : `Чек на ${formatSom(Number(job.payload?.totalMinor || 0))}`;
                  return (
                    <tr key={job.id}>
                      <td>{job.kind === 'label' ? 'Этикетка' : 'Чек'}</td>
                      <td>{summary}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            job.status === 'printed'
                              ? 'status-issued'
                              : job.status === 'failed'
                                ? 'status-cancelled'
                                : ''
                          }`}
                        >
                          {statusLabel(job.status)}
                        </span>
                        {job.error && (
                          <div className="error" style={{ fontSize: '12px' }}>
                            {job.error}
                          </div>
                        )}
                      </td>
                      <td>{formatDate(job.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {job.status !== 'printed' && (
                            <button
                              type="button"
                              className="primary button"
                              onClick={() => void executePrint(job)}
                            >
                              Печатать
                            </button>
                          )}
                          <button
                            type="button"
                            className="secondary button"
                            onClick={() => void removeJob(job.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {activeJob && (
        <div className="print-only" aria-hidden="true">
          {activeJob.kind === 'label' ? (
            <>
              <LabelPrintPage
                size={
                  activeJob.payload?.labelSize === '58x40' ? '58x40' : '30x20'
                }
              />
              <div className="catalog-bulk-print-sheet">
                {(Array.isArray(activeJob.payload?.items)
                  ? activeJob.payload.items
                  : [activeJob.payload]
                ).map((item: any, idx: number) => {
                  const copies = normalizeLabelCopies(String(item.copies ?? 1));
                  const size: LabelSize =
                    activeJob.payload?.labelSize === '58x40'
                      ? '58x40'
                      : '30x20';
                  const barcode = String(
                    item.shortBarcode || item.barcode || '',
                  );
                  return (
                    <div className="selected-label" key={idx}>
                      <BarcodeLabel
                        product={{
                          id: String(item.variantId || idx),
                          name: String(item.name || ''),
                          barcode,
                          shortBarcode: item.shortBarcode,
                          salePriceMinor: Number(item.priceMinor || 0),
                          sku: item.sku ?? null,
                        }}
                        copies={copies}
                        hidePrintButton
                        size={size}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="pos-receipt">
              <h3>{String(activeJob.payload?.shopName || 'Чек')}</h3>
              <p>{String(activeJob.payload?.createdAt || '')}</p>
              <hr />
              {(Array.isArray(activeJob.payload?.lines)
                ? activeJob.payload.lines
                : []
              ).map((line: any, i: number) => (
                <div
                  key={i}
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>
                    {line.name} × {line.quantity}
                  </span>
                  <span>
                    {formatSom(
                      (Number(line.unitPriceMinor || 0) -
                        Number(line.discountMinor || 0)) *
                        Number(line.quantity || 1),
                    )}
                  </span>
                </div>
              ))}
              <hr />
              <strong>
                Итого: {formatSom(Number(activeJob.payload?.totalMinor || 0))}
              </strong>
            </div>
          )}
        </div>
      )}
    </>
  );
}
