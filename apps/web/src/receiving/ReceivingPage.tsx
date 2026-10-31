import { useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { parseSom, formatSom } from '../api/money';
import { api, errorText } from '../api/client';
import { useEffect, useRef, useState } from 'react';
import { useDocument } from '../drafts/use-document';
import DocumentEditor from '../drafts/DocumentEditor';

function ReceivingWorkspace({
  shopId,
  userId,
}: {
  shopId: string;
  userId: string;
}) {
  const doc = useDocument({ userId, shopId, kind: 'receiving' });
  const [searchParams, setSearchParams] = useSearchParams();
  const createAtEntry = searchParams.get('create') === '1';
  const parentId = searchParams.get('parentId') || undefined;
  const beganEntry = useRef(false);
  useEffect(() => {
    if (createAtEntry && !beganEntry.current) {
      beganEntry.current = true;
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
      if (!doc.draft.primaryReceiving) void doc.beginProductCreation('');
    }
  }, [createAtEntry]);
  const [documentNumber, setDocumentNumber] = useState(
      doc.draft.submission?.body?.documentNumber ?? '',
    ),
    [supplier, setSupplier] = useState(
      doc.draft.submission?.body?.supplier ?? '',
    ),
    [receivedOn, setReceivedOn] = useState(
      doc.draft.submission?.body?.receivedOn ??
        new Date().toISOString().slice(0, 10),
    ),
    [comment, setComment] = useState(doc.draft.submission?.body?.comment ?? ''),
    [history, setHistory] = useState<any[]>([]),
    [selectedReceipt, setSelectedReceipt] = useState<any | null>(null),
    [detailError, setDetailError] = useState('');
  useEffect(() => {
    void api<any[]>(`/shops/${shopId}/receivings`)
      .then((items) => setHistory(Array.isArray(items) ? items : []))
      .catch(() => undefined);
  }, [shopId, doc.success]);
  async function openDetail(id: string) {
    setDetailError('');
    try {
      const detail = await api<any>(`/shops/${shopId}/receivings/${id}`);
      setSelectedReceipt(detail);
    } catch (e) {
      setDetailError(errorText(e));
    }
  }
  useEffect(() => {
    if (doc.success) {
      setDocumentNumber('');
      setSupplier('');
      setComment('');
    }
  }, [doc.success]);
  let sum = 0n;
  for (const l of doc.draft.lines) {
    try {
      sum += BigInt(parseSom(l.unitCostText ?? '')) * BigInt(l.quantity);
    } catch {}
  }
  const totalUnits = doc.draft.lines.reduce((n, l) => n + l.quantity, 0);
  const metaDisabled = doc.busy || !!doc.draft.submission;
  async function submit() {
    try {
      const body = doc.draft.submission?.body ?? {
        ...(documentNumber.trim()
          ? { documentNumber: documentNumber.trim() }
          : {}),
        supplier: supplier.trim(),
        receivedOn,
        comment: comment.trim(),
        lines: doc.draft.lines.map((l) => ({
          variantId: l.id,
          quantity: l.quantity,
          unitCostMinor: parseSom(l.unitCostText ?? ''),
        })),
      };
      const total = (
        body.lines as { quantity: number; unitCostMinor: number }[]
      ).reduce((n, l) => n + BigInt(l.quantity) * BigInt(l.unitCostMinor), 0n);
      if (total > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error('Сумма слишком велика.');
      await doc.send(
        `/shops/${shopId}/receivings`,
        body,
        doc.draft.primaryReceiving?.receivingKey,
      );
    } catch (e) {
      doc.setError(errorText(e));
    }
  }
  return (
    <div className="receiving-page">
      <div className="page-heading receiving-page-header">
        <div>
          <div className="receiving-title-row">
            <h1>Приёмка</h1>
            <span className="receiving-subtitle">Поступление товара</span>
          </div>
          <p className="muted">
            Сканируйте товар, укажите количество и закупочную цену
          </p>
        </div>
        <button
          type="button"
          className="button primary receiving-create-btn"
          disabled={
            doc.busy ||
            doc.blocked ||
            !doc.online ||
            !!doc.draft.submission ||
            !!doc.productCreation
          }
          onClick={() => void doc.beginProductCreation('')}
        >
          <span aria-hidden="true">+</span> Создать товар
        </button>
      </div>
      <div className="pos-grid receiving-workspace-grid">
        <DocumentEditor
          doc={doc}
          receiving
          shopId={shopId}
          parentId={parentId}
          receivingMetadata={{
            ...(documentNumber.trim()
              ? { documentNumber: documentNumber.trim() }
              : {}),
            supplier: supplier.trim(),
            receivedOn,
            comment: comment.trim(),
          }}
        />
        <aside className="panel summary-panel receiving-summary-panel">
          <h2>Итого к приёмке</h2>
          <details className="receiving-metadata" open>
            <summary>Дополнительные данные документа</summary>
            <div className="receiving-metadata-fields">
              <label>
                Поставщик
                <div className="receiving-supplier-box">
                  <input
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    disabled={metaDisabled}
                    placeholder="Например, ОсОО «ФудТрейд»"
                  />
                  {supplier && !metaDisabled && (
                    <button
                      type="button"
                      className="receiving-supplier-clear"
                      aria-label="Очистить поставщика"
                      onClick={() => setSupplier('')}
                    >
                      ×
                    </button>
                  )}
                </div>
              </label>
              <div className="receiving-meta-row">
                <label>
                  Номер документа
                  <input
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    disabled={metaDisabled}
                    placeholder="ПН-000123"
                  />
                </label>
                <label>
                  Дата поставки
                  <input
                    type="date"
                    value={receivedOn}
                    onChange={(e) => setReceivedOn(e.target.value)}
                    disabled={metaDisabled}
                  />
                </label>
              </div>
              <label>
                Комментарий
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={metaDisabled}
                  placeholder="Например, накладная №123"
                />
              </label>
            </div>
          </details>
          <div className="receiving-kpi-grid">
            <div className="receiving-kpi-tile">
              <span>Позиций</span>
              <strong>{doc.draft.lines.length}</strong>
            </div>
            <div className="receiving-kpi-tile">
              <span>Всего единиц</span>
              <strong>{totalUnits}</strong>
            </div>
            <div className="receiving-kpi-tile receiving-kpi-total">
              <span>Сумма к приёмке</span>
              <p className="total">
                {sum <= BigInt(Number.MAX_SAFE_INTEGER)
                  ? formatSom(Number(sum))
                  : 'Сумма превышена'}
              </p>
            </div>
          </div>
          <div className="receiving-info-box">
            <span className="receiving-info-icon" aria-hidden="true">
              i
            </span>
            <p className="muted">
              После проведения товар появится в остатках. Карточка сама не
              создаёт приход.
            </p>
          </div>
          <button
            className="primary full-width receiving-submit-btn"
            disabled={
              !doc.online ||
              doc.busy ||
              doc.blocked ||
              !!doc.productCreation ||
              !doc.draft.lines.length
            }
            onClick={() => void submit()}
          >
            <svg
              className="receiving-btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>
              {doc.busy
                ? 'Проведение…'
                : doc.draft.submission
                  ? 'Повторить исходный запрос'
                  : 'Провести приёмку'}
            </span>
          </button>
          <button
            type="button"
            className="secondary full-width receiving-print-btn"
            onClick={() => window.print()}
            disabled={!doc.draft.lines.length}
          >
            <svg
              className="receiving-btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9V4h12v5M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="6" />
            </svg>
            <span>Печать документа</span>
          </button>
        </aside>
      </div>
      <details className="panel receiving-history" open>
        <summary>История приёмок</summary>
        <div className="page-heading">
          <div>
            <h2>История приёмок</h2>
            <p className="muted">Последние 100 проведённых документов</p>
          </div>
        </div>
        {detailError && (
          <p role="alert" className="error">
            {detailError}
          </p>
        )}
        {selectedReceipt && (
          <div
            className="panel"
            style={{ marginBottom: '1rem' }}
            aria-label={`Детали приёмки ${selectedReceipt.documentNumber}`}
          >
            <div className="page-heading">
              <div>
                <h3>Накладная {selectedReceipt.documentNumber}</h3>
                <p className="muted">
                  Дата: {selectedReceipt.receivedOn} · Поставщик:{' '}
                  {selectedReceipt.supplier || '—'} · Создал:{' '}
                  {selectedReceipt.createdBy}
                </p>
                {selectedReceipt.comment && (
                  <p className="muted">
                    Комментарий: {selectedReceipt.comment}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setSelectedReceipt(null)}>
                Закрыть детали
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Количество</th>
                    <th>Закупочная цена</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipt.lines?.map((line: any) => (
                    <tr key={line.variantId}>
                      <td>
                        <strong>{line.name}</strong>
                        <small className="code">{line.barcode}</small>
                      </td>
                      <td>{line.quantity} шт.</td>
                      <td>{formatSom(Number(line.unitCostMinor))}</td>
                      <td>{formatSom(Number(line.valueMinor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!history.length ? (
          <p className="muted">Приёмок пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Дата</th>
                  <th>Поставщик</th>
                  <th>Сумма</th>
                  <th>Создал</th>
                  <th className="no-print">Состав</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.documentNumber}</td>
                    <td>{item.receivedOn}</td>
                    <td>{item.supplier || '—'}</td>
                    <td>{formatSom(Number(item.totalMinor))}</td>
                    <td>{item.createdBy}</td>
                    <td className="no-print">
                      <button
                        type="button"
                        onClick={() => void openDetail(item.id)}
                      >
                        Состав
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
export default function ReceivingPage() {
  const { shopId } = useParams(),
    s = useSession();
  if (s.user?.shops.find((x) => x.id === shopId)?.role === 'cashier')
    return <p role="alert">Недостаточно прав для приёмки.</p>;
  return (
    <ReceivingWorkspace
      key={shopId + s.user!.userId}
      shopId={shopId!}
      userId={s.user!.userId}
    />
  );
}
