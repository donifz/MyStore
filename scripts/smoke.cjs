// Uses the dedicated smoke database seeded by CI. Never run against a live store.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
async function main() {
  const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3001';
  const password = process.env.SMOKE_PASSWORD;
  if (!password) throw new Error('SMOKE_PASSWORD required');
  let token;
  async function call(path, body, key) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.ok(response.ok, `${path}: HTTP ${response.status}`);
    return response.json();
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      token = (
        await call('/auth/login', { email: 'owner@example.test', password })
      ).token;
      break;
    } catch (error) {
      if (attempt === 59) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const shop = '/shops/11111111-1111-4111-8111-111111111111';
  const barcode = `SMOKE${randomUUID().replaceAll('-', '')}`;
  const variant = await call(shop + '/variants', {
    name: 'Smoke product',
    barcode,
    salePriceMinor: 15000,
  });
  assert.equal(
    (await call(shop + '/variants/by-barcode?code=' + barcode)).id,
    variant.id,
  );
  await call(
    shop + '/receivings',
    { lines: [{ variantId: variant.id, quantity: 10, unitCostMinor: 10000 }] },
    randomUUID(),
  );
  await call(
    shop + '/sales',
    {
      lines: [
        { variantId: variant.id, quantity: 2, expectedUnitPriceMinor: 15000 },
      ],
    },
    randomUUID(),
  );
  assert.deepEqual(await call(shop + '/stock/' + variant.id), {
    physical: 8,
    reserved: 0,
    available: 8,
    stockValueMinor: 80000,
  });
  console.log('Smoke passed: login → lookup → receive 10 → sell 2 → stock 8');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
