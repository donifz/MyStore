export type DraftScope = {
  userId: string;
  shopId: string;
  kind: 'receiving' | 'sale' | 'return' | 'shift-open' | 'shift-close';
};
export type DraftLine = {
  id: string;
  name: string;
  barcode: string;
  quantity: number;
  priceMinor: number;
  unitCostText?: string;
};
export type Draft = {
  version: 1;
  scope: DraftScope;
  revision: string;
  lines: DraftLine[];
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
      Object.keys(line).some(
        (k) =>
          ![
            'id',
            'name',
            'barcode',
            'quantity',
            'priceMinor',
            ...(scope.kind === 'receiving' ? ['unitCostText'] : []),
          ].includes(k),
      )
    )
      throw new Error('Черновик содержит неверные данные.');
  }
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
export function save(draft: Draft, expectedRevision?: string): void {
  validate(draft, draft.scope);
  const existing = load(draft.scope);
  if (existing && existing.revision !== (expectedRevision ?? draft.revision))
    throw new Error('Черновик изменён в другом окне. Обновите его.');
  localStorage.setItem(storageKey(draft.scope), JSON.stringify(draft));
}
export function clear(scope: DraftScope, expectedRevision: string) {
  const current = load(scope);
  if (current?.revision === expectedRevision)
    localStorage.removeItem(storageKey(scope));
}
export function clearUser(userId: string) {
  for (const key of Object.keys(localStorage))
    if (key.startsWith('mystore:draft:' + userId + ':'))
      localStorage.removeItem(key);
}
