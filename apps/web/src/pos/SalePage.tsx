import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { formatSom } from '../api/money';
import { useDocument } from '../drafts/use-document';
import DocumentEditor from '../drafts/DocumentEditor';
import { useCurrentShift } from './use-current-shift';
function SaleWorkspace({ shopId, userId }: { shopId: string; userId: string }) {
  const doc = useDocument({ userId, shopId, kind: 'sale' }),
    [method, setMethod] = useState<'cash' | 'card'>('cash'),
    shift = useCurrentShift(shopId, doc.success);
  const active = shift.current && 'id' in shift.current ? shift.current : null;
  const sum = doc.draft.lines.reduce(
      (n, l) => n + BigInt(l.quantity) * BigInt(l.priceMinor),
      0n,
    ),
    safe = sum <= BigInt(Number.MAX_SAFE_INTEGER);
  async function submit() {
    if (doc.draft.submission) {
      await doc.send(`/shops/${shopId}/pos/sales`, doc.draft.submission.body);
      return;
    }
    if (!active) {
      doc.setError('Сначала откройте свою смену.');
      return;
    }
    if (!safe) {
      doc.setError('Сумма слишком велика.');
      return;
    }
    await doc.send(`/shops/${shopId}/pos/sales`, {
      shiftId: active.id,
      method,
      lines: doc.draft.lines.map((l) => ({
        variantId: l.id,
        quantity: l.quantity,
        expectedUnitPriceMinor: l.priceMinor,
      })),
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Продажи в торговой точке</p>
          <h1>Касса</h1>
          <p className="muted">
            Сканируйте товары и подтвердите получение оплаты
          </p>
        </div>
        <Link className="button" to={'/seller/' + shopId + '/shift'}>
          Управление сменой
        </Link>
      </div>
      {shift.error && (
        <p role="alert" className="error">
          {shift.error}
        </p>
      )}
      {!shift.loading && !active && (
        <p className="notice">
          {shift.current
            ? 'Касса занята другим сотрудником.'
            : 'Смена не открыта. Откройте её перед продажей.'}
        </p>
      )}
      <div className="pos-grid">
        <DocumentEditor doc={doc} receiving={false} shopId={shopId} />
        <aside className="panel summary-panel">
          <h2>Оплата</h2>
          <p className="muted">
            {doc.draft.lines.reduce((n, l) => n + l.quantity, 0)} шт. в корзине
          </p>
          <p className="total">
            {safe ? formatSom(Number(sum)) : 'Сумма превышена'}
          </p>
          <label>
            Способ оплаты
            <select
              value={doc.draft.submission?.body.method ?? method}
              disabled={doc.busy || !!doc.draft.submission}
              onChange={(e) => setMethod(e.target.value as 'cash' | 'card')}
            >
              <option value="cash">Наличные</option>
              <option value="card">Карта</option>
            </select>
          </label>
          <p className="muted">
            Проводите продажу после получения денег. Оплата картой здесь
            отмечается вручную.
          </p>
          <button
            className="primary full-width"
            onClick={() => void submit()}
            disabled={
              doc.busy ||
              doc.blocked ||
              !doc.online ||
              !doc.draft.lines.length ||
              (!doc.draft.submission && (!active || !safe))
            }
          >
            {doc.busy
              ? 'Проведение…'
              : doc.draft.submission
                ? 'Повторить исходный запрос'
                : 'Провести продажу'}
          </button>
        </aside>
      </div>
    </>
  );
}
export default function SalePage() {
  const { shopId } = useParams(),
    session = useSession();
  return (
    <SaleWorkspace
      key={shopId + session.user!.userId}
      shopId={shopId!}
      userId={session.user!.userId}
    />
  );
}
