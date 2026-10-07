import { ApiError } from '../api/client';
import { Draft, save, clear, load, withDraftLock } from './draft-store';
export async function submitDocument<T>(
  draft: Draft,
  send: (key: string, body: any, path?: string) => Promise<T>,
  captured?: (pending: Draft) => void,
): Promise<T> {
  if (!draft.submission) throw new Error('Нет подготовленной операции.');
  const pending = await withDraftLock(draft.scope, () => {
    const current = load(draft.scope);
    if (current && current.revision !== draft.revision)
      throw new Error('Черновик изменён в другом окне. Обновите его.');
    // An existing pending request always wins, including its immutable URL/body.
    const submission = current?.submission ?? {
      ...draft.submission!,
      key: current ? current.revision : draft.submission!.key,
    };
    const next: Draft = {
      ...draft,
      submission: { ...submission, status: 'pending' },
    };
    save(next);
    captured?.(next);
    return next;
  });
  try {
    const result = await send(
      pending.submission!.key,
      pending.submission!.body,
      pending.submission!.path,
    );
    await withDraftLock(draft.scope, () => clear(draft.scope, draft.revision));
    return result;
  } catch (error) {
    await withDraftLock(draft.scope, () => {
      const existing = load(draft.scope);
      if (
        existing?.revision === draft.revision &&
        existing.submission?.key === pending.submission!.key
      ) {
        const definite =
          error instanceof ApiError &&
          (error.status === 400 ||
            (error.status === 409 &&
              error.message !== 'Key reused with different request'));
        save(
          {
            ...pending,
            submission: definite
              ? null
              : { ...pending.submission!, status: 'unknown' },
          },
          draft.revision,
          true,
        );
      }
    });
    throw error;
  }
}
