import { ApiError } from '../api/client';
import { Draft, save, clear, load } from './draft-store';
export async function submitDocument<T>(
  draft: Draft,
  send: (key: string, body: any) => Promise<T>,
): Promise<T> {
  if (!draft.submission) throw new Error('Нет подготовленной операции.');
  const current = load(draft.scope);
  if (current && current.revision !== draft.revision)
    throw new Error('Черновик изменён в другом окне. Обновите его.');
  const pending = {
    ...draft,
    submission: { ...draft.submission, status: 'pending' as const },
  };
  save(pending);
  try {
    const result = await send(pending.submission.key, pending.submission.body);
    clear(draft.scope, draft.revision);
    return result;
  } catch (error) {
    const existing = load(draft.scope);
    if (existing?.revision === draft.revision) {
      const definite =
        error instanceof ApiError &&
        [400, 403, 404, 409].includes(error.status);
      save({
        ...pending,
        submission: definite
          ? null
          : { ...pending.submission, status: 'unknown' },
      });
    }
    throw error;
  }
}
