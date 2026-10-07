import { beforeEach, expect, it, vi } from 'vitest';
import { Draft, load, save, clear, clearUser, storageKey } from './draft-store';
import { submitDocument } from './document-state';
const scope = { userId: 'alice', shopId: 'shop', kind: 'sale' as const };
const make = (): Draft => ({
  version: 1,
  scope,
  revision: crypto.randomUUID(),
  lines: [
    { id: 'v', name: 'Bag', barcode: '001', quantity: 2, priceMinor: 15000 },
  ],
  submission: {
    key: 'same-key',
    body: {
      lines: [{ variantId: 'v', quantity: 2, expectedUnitPriceMinor: 15000 }],
    },
    status: 'pending',
  },
});
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
it('keeps unknown result and retries the exact saved payload after reload', async () => {
  const d = make();
  await expect(
    submitDocument(d, async () => {
      throw new TypeError('lost response');
    }),
  ).rejects.toThrow();
  const restored = load(scope)!;
  expect(restored.submission?.status).toBe('unknown');
  expect(restored.submission?.key).toBe('same-key');
  const result = await submitDocument(restored, async (key, body) => {
    expect(key).toBe('same-key');
    expect(body).toEqual({
      lines: [{ variantId: 'v', quantity: 2, expectedUnitPriceMinor: 15000 }],
    });
    return { id: 'doc' };
  });
  expect(result).toEqual({ id: 'doc' });
  expect(load(scope)).toBeNull();
});
it('isolates users, protects newer revisions, and clears only logged-out user', () => {
  const d = make();
  save(d);
  expect(load({ ...scope, userId: 'bob' })).toBeNull();
  const newer = { ...d, revision: 'new' };
  save(newer, d.revision);
  clear(scope, d.revision);
  expect(load(scope)?.revision).toBe('new');
  expect(() => save(d, d.revision)).toThrow();
  clearUser('bob');
  expect(load(scope)).not.toBeNull();
  clearUser('alice');
  expect(load(scope)).toBeNull();
});
it('same pending payload from two windows uses one key and preserves edits made later', async () => {
  const d = make();
  save(d);
  const other = load(scope)!;
  const keys: string[] = [];
  const sent = async (key: string) => {
    keys.push(key);
    return { id: 'doc' };
  };
  await Promise.all([submitDocument(d, sent), submitDocument(other, sent)]);
  expect(keys).toEqual(['same-key', 'same-key']);
  expect(load(scope)).toBeNull();
});
it('damaged JSON cannot silently overwrite an unknown operation', () => {
  localStorage.setItem(storageKey(scope), '{bad');
  expect(() => load(scope)).toThrow();
  expect(() => save(make())).toThrow();
});
it('storage quota failure prevents transmission', async () => {
  const d = make();
  let sent = false;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await expect(
    submitDocument(d, async () => {
      sent = true;
    }),
  ).rejects.toThrow();
  expect(sent).toBe(false);
});
