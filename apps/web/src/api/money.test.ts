import { expect, it } from 'vitest';
it('parses som exactly and rejects ambiguous or unsafe input', async () => {
  const m = await import('./money').catch(() => null);
  expect(m).not.toBeNull();
  if (!m) return;
  expect(m.parseSom('150,25')).toBe(15025);
  expect(m.parseSom('0')).toBe(0);
  for (const input of ['1e3', '-1', '1.234', '90071992547409.92', ''])
    expect(() => m.parseSom(input)).toThrow();
});
