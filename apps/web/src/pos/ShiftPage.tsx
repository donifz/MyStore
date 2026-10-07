import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { parseSom, formatSom, formatDate } from '../api/money';
import { errorText } from '../api/client';
import { useDocument } from '../drafts/use-document';
import { useCurrentShift } from './use-current-shift';
import { Shift } from '../api/types';
function ShiftWorkspace({
  shopId,
  userId,
}: {
  shopId: string;
  userId: string;
}) {
  const opening = useDocument({ shopId, userId, kind: 'shift-open' }),
    closing = useDocument({ shopId, userId, kind: 'shift-close' }),
    [openingCash, setOpeningCash] = useState('0'),
    [actual, setActual] = useState(''),
    [comment, setComment] = useState(''),
    [lastClosed, setLastClosed] = useState<Shift | null>(null),
    s = useCurrentShift(
      shopId,
      opening.success + closing.success,
      useSession().user?.shops.find((x) => x.id === shopId)?.role === 'owner',
    );
  const shift = s.current && 'id' in s.current ? s.current : null;
  async function open() {
    try {
      await opening.send(
        `/shops/${shopId}/pos/shifts`,
        opening.draft.submission?.body ?? {
          openingCashMinor: parseSom(openingCash),
        },
      );
    } catch (e) {
      opening.setError(errorText(e));
    }
  }
  async function submitClose() {
    try {
      if (!shift && !closing.draft.submission) return;
      const body = closing.draft.submission?.body ?? {
        actualCashMinor: parseSom(actual),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      };
      const result = await closing.send(
        closing.draft.submission?.path ??
          `/shops/${shopId}/pos/shifts/${shift!.id}/close`,
        body,
      );
      if (result) setLastClosed(result as Shift);
    } catch (e) {
      closing.setError(errorText(e));
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Контроль кассы</p>
          <h1>Смена</h1>
        </div>
        <Link className="button" to={'/seller/' + shopId + '/pos'}>
          Перейти к кассе
        </Link>
      </div>
      {s.error && (
        <p role="alert" className="error">
          {s.error}
        </p>
      )}
      {s.loading && <p>Загрузка…</p>}
      {s.current && 'occupied' in s.current && (
        <p className="notice">Касса занята другим сотрудником.</p>
      )}
      {closing.draft.submission && !shift && (
        <button
          className="primary"
          disabled={closing.busy || closing.blocked || !closing.online}
          onClick={() => void submitClose()}
        >
          Повторить закрытие
        </button>
      )}
      {lastClosed && (
        <section className="panel">
          <h2>Смена закрыта</h2>
          <p>Расхождение: {formatSom(lastClosed.discrepancyMinor ?? 0)}</p>
          <p>
            Фактические наличные: {formatSom(lastClosed.actualCashMinor ?? 0)}
          </p>
        </section>
      )}
      {shift ? (
        <>
          <section className="panel">
            <h2>Смена открыта</h2>
            <p className="muted">С {formatDate(shift.openedAt)}</p>
            <div className="stats">
              <div className="panel">
                Ожидаемые наличные
                <strong>{formatSom(shift.expectedCashMinor)}</strong>
              </div>
              <div className="panel">
                Продажи наличными
                <strong>{formatSom(shift.salesCashMinor)}</strong>
              </div>
              <div className="panel">
                Продажи картой<strong>{formatSom(shift.salesCardMinor)}</strong>
              </div>
              <div className="panel">
                Возвраты наличными
                <strong>{formatSom(shift.refundsCashMinor)}</strong>
              </div>
              <div className="panel">
                Возвраты картой
                <strong>{formatSom(shift.refundsCardMinor)}</strong>
              </div>
            </div>
            <div className="form-panel">
              <label>
                Фактические наличные, сом
                <input
                  inputMode="decimal"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  disabled={!!closing.draft.submission}
                />
              </label>
              <label>
                Комментарий к закрытию
                <textarea
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={!!closing.draft.submission}
                />
              </label>
              <p className="muted">
                При расхождении укажите причину. Проведённые документы остаются
                в истории.
              </p>
              <button
                className="primary"
                disabled={closing.busy || closing.blocked || !closing.online}
                onClick={() => void submitClose()}
              >
                {closing.draft.submission
                  ? 'Повторить закрытие'
                  : 'Закрыть смену'}
              </button>
            </div>
          </section>
        </>
      ) : (
        !s.current &&
        !s.loading && (
          <section className="panel form-panel">
            <h2>Открыть смену</h2>
            <label>
              Начальные наличные, сом
              <input
                inputMode="decimal"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                disabled={!!opening.draft.submission}
              />
            </label>
            <button
              className="primary"
              disabled={opening.busy || opening.blocked || !opening.online}
              onClick={() => void open()}
            >
              {opening.draft.submission
                ? 'Повторить открытие'
                : 'Открыть смену'}
            </button>
          </section>
        )
      )}
      {[opening, closing].map((doc, i) => (
        <div key={i}>
          {doc.error && (
            <p role="alert" className="error">
              {doc.error}
            </p>
          )}
          {doc.blocked && (
            <button onClick={doc.reload}>Обновить черновик</button>
          )}
          {doc.draft.submission && (
            <p className="notice">
              Результат неизвестен. Повтор использует прежние данные.
            </p>
          )}
        </div>
      ))}
    </>
  );
}
export default function ShiftPage() {
  const { shopId } = useParams(),
    s = useSession();
  return (
    <ShiftWorkspace
      key={shopId + s.user!.userId}
      shopId={shopId!}
      userId={s.user!.userId}
    />
  );
}
