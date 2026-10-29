export type DraftScope = {
  userId: string;
  shopId: string;
  kind:
    | 'receiving'
    | 'sale'
    | 'return'
    | 'shift-open'
    | 'shift-close'
    | 'order-issue'
    | 'capture';
};
export type DraftLine = {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  priceMinor: number;
  unitCostText?: string;
  lastPurchaseMinor?: number;
  discountMinor?: number;
  discountReason?: string;
};
export type PrimaryReceivingWorkflow = {
  workflowId: string;
  barcode: string;
  productKey: string;
  receivingKey: string;
};
export type Draft = {
  version: 1;
  scope: DraftScope;
  revision: string;
  lines: DraftLine[];
  primaryReceiving?: PrimaryReceivingWorkflow;
  submission: null | {
    key: string;
    path?: string;
    body: any;
    status: 'pending' | 'unknown';
  };
};
export function storageKey(scope: DraftScope) {
  return (
    'mystore:draft:' + scope.userId + ':' + scope.shopId + ':' + scope.kind
  );
}
function validate(d: any, scope: DraftScope): asserts d is Draft {
  if (
    d?.version !== 1 ||
    d.scope?.userId !== scope.userId ||
    d.scope?.shopId !== scope.shopId ||
    d.scope?.kind !== scope.kind ||
    typeof d.revision !== 'string' ||
    !d.revision ||
    !Array.isArray(d.lines) ||
    d.lines.length > 100
  )
    throw new Error('Черновик повреждён. Проведение заблокировано.');
  for (const line of d.lines) {
    if (
      typeof line.id !== 'string' ||
      typeof line.name !== 'string' ||
      typeof line.barcode !== 'string' ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 1e9 ||
      !Number.isSafeInteger(line.priceMinor) ||
      line.priceMinor < 0 ||
      (line.lastPurchaseMinor !== undefined &&
        (!Number.isSafeInteger(line.lastPurchaseMinor) ||
          line.lastPurchaseMinor < 0)) ||
      (line.discountMinor !== undefined &&
        (!Number.isSafeInteger(line.discountMinor) ||
          line.discountMinor < 0)) ||
      (line.discountReason !== undefined &&
        typeof line.discountReason !== 'string') ||
      Object.keys(line).some(
        (k) =>
          ![
            'id',
            'name',
            'barcode',
            'quantity',
            'priceMinor',
            ...(scope.kind === 'receiving'
              ? ['unitCostText', 'lastPurchaseMinor']
              : []),
            ...(scope.kind === 'sale'
              ? ['discountMinor', 'discountReason']
              : []),
          ].includes(k),
      )
    )
      throw new Error('Черновик содержит неверные данные.');
  }
  if (
    d.primaryReceiving !== undefined &&
    (!d.primaryReceiving ||
      typeof d.primaryReceiving.workflowId !== 'string' ||
      !d.primaryReceiving.workflowId ||
      typeof d.primaryReceiving.barcode !== 'string' ||
      !d.primaryReceiving.barcode ||
      typeof d.primaryReceiving.productKey !== 'string' ||
      !d.primaryReceiving.productKey ||
      typeof d.primaryReceiving.receivingKey !== 'string' ||
      !d.primaryReceiving.receivingKey)
  )
    throw new Error('Сценарий первичной приёмки повреждён.');
  if (
    d.submission !== null &&
    (typeof d.submission?.key !== 'string' ||
      !d.submission.key ||
      !['pending', 'unknown'].includes(d.submission.status) ||
      typeof d.submission.body !== 'object' ||
      d.submission.body === null)
  )
    throw new Error('Неподтверждённая операция повреждена.');
}
export function load(scope: DraftScope): Draft | null {
  const raw = localStorage.getItem(storageKey(scope));
  if (raw === null) return null;
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    throw new Error('Черновик повреждён. Проведение заблокировано.');
  }
  validate(d, scope);
  return d;
}
export function save(
  draft: Draft,
  expectedRevision?: string,
  settlement = false,
): void {
  validate(draft, draft.scope);
  const existing = load(draft.scope);
  if (existing && existing.revision !== (expectedRevision ?? draft.revision))
    throw new Error('Черновик изменён в другом окне. Обновите его.');
  if (
    existing?.submission &&
    !settlement &&
    (draft.revision !== existing.revision ||
      !draft.submission ||
      draft.submission.key !== existing.submission.key ||
      draft.submission.path !== existing.submission.path ||
      JSON.stringify(draft.submission.body) !==
        JSON.stringify(existing.submission.body) ||
      JSON.stringify(draft.lines) !== JSON.stringify(existing.lines))
  )
    throw new Error(
      'Неподтверждённая операция зафиксирована. Повторите исходный запрос.',
    );
  if (
    !existing &&
    localStorage.getItem(storageKey(draft.scope) + ':settled') ===
      (expectedRevision ?? draft.revision)
  )
    throw new Error(
      'Операция уже подтверждена в другом окне. Обновите черновик.',
    );
  localStorage.setItem(storageKey(draft.scope), JSON.stringify(draft));
}
export function clear(scope: DraftScope, expectedRevision: string) {
  const current = load(scope);
  if (current?.revision === expectedRevision) {
    localStorage.setItem(storageKey(scope) + ':settled', expectedRevision);
    localStorage.removeItem(storageKey(scope));
  }
}
export function clearUser(userId: string) {
  for (const key of Object.keys(localStorage))
    if (key.startsWith('mystore:draft:' + userId + ':'))
      localStorage.removeItem(key);
}

// Web Locks serialize capture, editing and settlement across same-origin tabs.
export async function withDraftLock<T>(
  scope: DraftScope,
  work: () => T | Promise<T>,
): Promise<T> {
  if (!navigator.locks)
    return Promise.reject(
      new Error(
        'Для безопасной работы кассы нужен браузер с Web Locks и HTTPS (либо localhost).',
      ),
    );
  return await navigator.locks.request(storageKey(scope), work);
}
