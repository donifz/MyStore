import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { parseSom, formatSom } from '../api/money';
import { errorText } from '../api/client';
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
  let sum = 0n;
  for (const l of doc.draft.lines) {
    try {
      sum += BigInt(parseSom(l.unitCostText ?? '')) * BigInt(l.quantity);
    } catch {}
  }
  async function submit() {
    try {
      const body = doc.draft.submission?.body ?? {
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
      await doc.send(`/shops/${shopId}/receivings`, body);
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
        <Link className="button" to={'/seller/' + shopId + '/products/new'}>
          Создать товар
        </Link>
      </div>
      <div className="pos-grid">
        <DocumentEditor doc={doc} receiving shopId={shopId} />
        <aside className="panel summary-panel">
          <h2>Документ прихода</h2>
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
        </aside>
      </div>
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
