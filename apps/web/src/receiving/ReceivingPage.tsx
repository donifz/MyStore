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
    [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    void api<any[]>(`/shops/${shopId}/receivings`)
      .then(setHistory)
      .catch(() => undefined);
  }, [shopId, doc.success]);
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
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Поступление товара</p>
          <h1>Приёмка</h1>
          <p className="muted">
            Отсканируйте товары, укажите количество и закупочную цену
          </p>
        </div>
        <button
          type="button"
          className="button"
          disabled={
            doc.busy ||
            doc.blocked ||
            !doc.online ||
            !!doc.draft.submission ||
            !!doc.productCreation
          }
          onClick={() => void doc.beginProductCreation('')}
        >
          Создать товар
        </button>
      </div>
      <div className="pos-grid">
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
        <aside className="panel summary-panel">
          <h2>Документ прихода</h2>
          <label>
            Номер документа
            <input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              disabled={doc.busy || !!doc.draft.submission}
              placeholder="Например, ТТН-001 (или оставьте пустым)"
            />
          </label>
          <label>
            Поставщик
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              disabled={doc.busy || !!doc.draft.submission}
              placeholder="Название или ИНН"
            />
          </label>
          <label>
            Дата поставки
            <input
              type="date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              disabled={doc.busy || !!doc.draft.submission}
            />
          </label>
          <label>
            Комментарий
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={doc.busy || !!doc.draft.submission}
              rows={3}
              placeholder="Примечание к поставке"
            />
          </label>
          <p>{doc.draft.lines.reduce((n, l) => n + l.quantity, 0)} шт.</p>
          <p className="total">
            {sum <= BigInt(Number.MAX_SAFE_INTEGER)
              ? formatSom(Number(sum))
              : 'Сумма превышена'}
          </p>
          <p className="muted">
            После проведения товар появится в остатках. Карточка сама не создаёт
            приход.
          </p>
          <button
            className="primary full-width"
            disabled={
              !doc.online ||
              doc.busy ||
              doc.blocked ||
              !!doc.productCreation ||
              !doc.draft.lines.length
            }
            onClick={() => void submit()}
          >
            {doc.busy
              ? 'Проведение…'
              : doc.draft.submission
                ? 'Повторить исходный запрос'
                : 'Провести приёмку'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!doc.draft.lines.length}
          >
            Печать документа
          </button>
        </aside>
      </div>
      <section className="panel receiving-history">
        <div className="page-heading">
          <div>
            <h2>История приёмок</h2>
            <p className="muted">Последние 100 проведённых документов</p>
          </div>
        </div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
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
