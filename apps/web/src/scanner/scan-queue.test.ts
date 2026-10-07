import { expect, it, vi } from 'vitest';
import { createScanQueue } from './scan-queue';
it('preserves leading zeros and accounts for fast repeated scans in order', async () => {
  const seen: string[] = [],
    added: string[] = [],
    errors: string[] = [];
  const q = createScanQueue(
    async (code: string) => {
      seen.push(code);
      if (code === 'missing') throw new Error('unknown');
      await new Promise((r) => setTimeout(r, 5));
      return { id: code, name: 'Bag', barcode: code, salePriceMinor: 100 };
    },
    (v: any) => added.push(v.barcode),
    (e: unknown) => errors.push(e instanceof Error ? e.message : String(e)),
  );
  ['00123', '00123', 'missing', '00123'].forEach((code) => q.enqueue(code));
  await vi.waitFor(() => expect(added).toEqual(['00123', '00123', '00123']));
  expect(seen).toEqual(['00123', '00123', 'missing', '00123']);
  expect(errors).toEqual(['unknown']);
});
it('does not add a stale lookup result after disposing shop context', async () => {
  let resolve!: (v: any) => void;
  const added: string[] = [];
  const q = createScanQueue(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    (v: any) => added.push(v.id),
    () => {},
  );
  q.enqueue('001');
  await Promise.resolve();
  q.dispose();
  resolve({ id: 'old', barcode: '001', name: 'Bag', salePriceMinor: 100 });
  await Promise.resolve();
  await Promise.resolve();
  expect(added).toEqual([]);
});
