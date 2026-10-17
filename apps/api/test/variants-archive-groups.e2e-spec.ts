import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture, approveTestProduct } from './helpers';

describe('catalog archive and variant groups', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let shopSlug: string;
  const root = `/shops/${fixture.shop}`;

  beforeAll(async () => {
    ctx = await setup(createApp);
    // Publish storefront profile so it can accept public storefront traffic
    const profileRes = await request(ctx.app.getHttpServer())
      .put(`${root}/storefront`)
      .auth(ctx.owner, { type: 'bearer' })
      .send({
        description: 'Test catalog store',
        city: 'Бишкек',
        address: 'Чуй 100',
        phone: '+996555000111',
        hours: '09:00–21:00',
        published: true,
      })
      .expect(200);
    shopSlug = profileRes.body.slug;
  });

  afterAll(async () => {
    await teardown(ctx);
  });

  const post = (
    path: string,
    body: any,
    token = ctx.owner,
    key = randomUUID(),
  ) =>
    request(ctx.app.getHttpServer())
      .post(root + path)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);

  const put = (path: string, body: any = {}, token = ctx.owner) =>
    request(ctx.app.getHttpServer())
      .put(root + path)
      .auth(token, { type: 'bearer' })
      .send(body);

  const get = (path: string, token = ctx.owner) =>
    request(ctx.app.getHttpServer())
      .get(root + path)
      .auth(token, { type: 'bearer' });

  test('creates root and child variants with independent barcodes and prices', async () => {
    const parentRes = await post('/variants', {
      name: 'Classic Hoodie',
      barcode: 'HOODIE-BASE',
      salePriceMinor: 250000,
      size: 'M',
      color: 'Black',
    }).expect(201);

    const parentId = parentRes.body.id;
    expect(parentId).toBeDefined();
    expect(parentRes.body.archived).toBe(false);

    const childRes1 = await post('/variants', {
      name: 'Classic Hoodie - Red L',
      barcode: 'HOODIE-RED-L',
      salePriceMinor: 260000,
      size: 'L',
      color: 'Red',
      parentId,
    }).expect(201);

    const childRes2 = await post('/variants', {
      name: 'Classic Hoodie - Blue XL',
      barcode: 'HOODIE-BLUE-XL',
      salePriceMinor: 270000,
      size: 'XL',
      color: 'Blue',
      parentId,
    }).expect(201);

    expect(childRes1.body.parentId).toBe(parentId);
    expect(childRes2.body.parentId).toBe(parentId);

    // Group retrieval from root
    const groupFromRoot = await get(`/variants/${parentId}/variants`).expect(
      200,
    );
    expect(groupFromRoot.body).toHaveLength(3);
    const ids = groupFromRoot.body.map((v: any) => v.id);
    expect(ids).toContain(parentId);
    expect(ids).toContain(childRes1.body.id);
    expect(ids).toContain(childRes2.body.id);

    // Group retrieval from child resolves to same root
    const groupFromChild = await get(
      `/variants/${childRes1.body.id}/variants`,
    ).expect(200);
    expect(groupFromChild.body).toHaveLength(3);
    expect(groupFromChild.body.map((v: any) => v.id)).toEqual(ids);
  });

  test('cannot archive variant with active reservations', async () => {
    const vRes = await post('/variants', {
      name: 'Reserved Shoe',
      barcode: 'SHOE-RES',
      salePriceMinor: 500000,
    }).expect(201);
    const vId = vRes.body.id;

    // Receive stock of 5
    await post('/receivings', {
      lines: [{ variantId: vId, quantity: 5, unitCostMinor: 200000 }],
    }).expect(201);

    // Publish shop and variant
    await ctx.db.query('UPDATE variants SET published=true WHERE id=$1', [vId]);
    await approveTestProduct(ctx.db, vId);

    // Place an online order to create a reservation
    const checkoutKey = randomUUID();
    const orderRes = await request(ctx.app.getHttpServer())
      .post('/public/orders')
      .set('origin', 'http://localhost:5173')
      .send({
        checkoutKey,
        storeSlug: shopSlug,
        name: 'Aibek',
        phone: '+996555123456',
        fulfillment: 'pickup',
        address: '',
        comment: '',
        lines: [
          { variantId: vId, quantity: 2, expectedUnitPriceMinor: 500000 },
        ],
      })
      .expect(201);

    const orderId = orderRes.body.id;

    // Attempt to archive -> must fail with 409
    const archiveAttempt = await put(`/variants/${vId}/archive`).expect(409);
    expect(archiveAttempt.body.message).toContain('active reservations');

    // Cancel order to release reservation
    await post(`/orders/${orderId}/status`, { status: 'cancelled' }).expect(
      201,
    );

    // Now archiving should succeed
    const archivedRes = await put(`/variants/${vId}/archive`).expect(200);
    expect(archivedRes.body.archived).toBe(true);

    // Audit log check
    const audit = await ctx.db.query(
      "SELECT * FROM audit_log WHERE shop_id=$1 AND entity_id=$2 AND action='archived'",
      [fixture.shop, vId],
    );
    expect(audit).toHaveLength(1);
  });

  test('blocks receiving and POS sales on archived variant', async () => {
    const vRes = await post('/variants', {
      name: 'Winter Coat',
      barcode: 'COAT-01',
      salePriceMinor: 800000,
    }).expect(201);
    const vId = vRes.body.id;

    // Receive stock before archiving
    await post('/receivings', {
      lines: [{ variantId: vId, quantity: 10, unitCostMinor: 400000 }],
    }).expect(201);

    // Open shift
    const shiftRes = await post('/pos/shifts', {
      openingCashMinor: 1000,
    }).expect(201);
    const shiftId = shiftRes.body.id;

    // Archive variant
    await put(`/variants/${vId}/archive`).expect(200);

    // Attempt to receive stock -> 409 Conflict
    const receiveBlocked = await post('/receivings', {
      lines: [{ variantId: vId, quantity: 5, unitCostMinor: 400000 }],
    }).expect(409);
    expect(receiveBlocked.body.message).toContain('archived');

    // Attempt POS sale -> 409 Conflict
    const saleBlocked = await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [{ variantId: vId, quantity: 1, expectedUnitPriceMinor: 800000 }],
    }).expect(409);
    expect(saleBlocked.body.message).toContain('archived');

    // Attempt to add child variant to archived parent -> 409 Conflict
    const childBlocked = await post('/variants', {
      name: 'Winter Coat - Child',
      barcode: 'COAT-01-CHILD',
      salePriceMinor: 800000,
      parentId: vId,
    }).expect(409);
    expect(childBlocked.body.message).toContain('archived');

    // Close shift so subsequent tests can open shifts if needed
    await post(`/pos/shifts/${shiftId}/close`, {
      actualCashMinor: 1000,
    }).expect(201);
  });

  test('preserves historical returns on variant after it is archived', async () => {
    const vRes = await post('/variants', {
      name: 'Vintage Cap',
      barcode: 'CAP-001',
      salePriceMinor: 50000,
    }).expect(201);
    const vId = vRes.body.id;

    await post('/receivings', {
      lines: [{ variantId: vId, quantity: 5, unitCostMinor: 20000 }],
    }).expect(201);

    const shiftRes = await post('/pos/shifts', {
      openingCashMinor: 5000,
    }).expect(201);
    const shiftId = shiftRes.body.id;

    // Sell 2 units
    const saleRes = await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [{ variantId: vId, quantity: 2, expectedUnitPriceMinor: 50000 }],
    }).expect(201);
    const saleId = saleRes.body.id;

    const saleLines = await ctx.db.query(
      'SELECT id FROM sale_lines WHERE document_id=$1',
      [saleId],
    );
    const saleLineId = saleLines[0].id;

    // Now archive the variant
    await put(`/variants/${vId}/archive`).expect(200);

    // Process a return for 1 unit of the historical sale
    const returnRes = await post('/pos/returns', {
      saleId,
      shiftId,
      method: 'cash',
      refundMoney: true,
      reason: 'Клиент передумал',
      lines: [{ saleLineId, quantity: 1, condition: 'resellable' }],
    }).expect(201);

    expect(returnRes.body.id).toBeDefined();

    // Verify stock balance has 4 physical items (5 received - 2 sold + 1 returned)
    const stockRes = await get(`/stock/${vId}`).expect(200);
    expect(stockRes.body.physical).toBe(4);

    // Close shift (5000 opening + 100000 sale - 50000 return = 55000 expected)
    await post(`/pos/shifts/${shiftId}/close`, {
      actualCashMinor: 55000,
    }).expect(201);
  });

  test('unarchive variant restores availability and logs audit event', async () => {
    const vRes = await post('/variants', {
      name: 'Summer Shorts',
      barcode: 'SHORTS-01',
      salePriceMinor: 120000,
    }).expect(201);
    const vId = vRes.body.id;

    // Archive it
    await put(`/variants/${vId}/archive`).expect(200);

    // Verify it is filtered out of default list
    const activeList = await get('/variants?q=Summer+Shorts').expect(200);
    expect(activeList.body.items).toHaveLength(0);

    // Verify it appears in archived list
    const archivedList = await get(
      '/variants?q=Summer+Shorts&archived=true',
    ).expect(200);
    expect(archivedList.body.items).toHaveLength(1);
    expect(archivedList.body.items[0].id).toBe(vId);

    // Unarchive
    const unarchivedRes = await put(`/variants/${vId}/unarchive`).expect(200);
    expect(unarchivedRes.body.archived).toBe(false);

    // Audit log check
    const audit = await ctx.db.query(
      "SELECT * FROM audit_log WHERE shop_id=$1 AND entity_id=$2 AND action='unarchived'",
      [fixture.shop, vId],
    );
    expect(audit).toHaveLength(1);

    // Receive stock should now succeed
    await post('/receivings', {
      lines: [{ variantId: vId, quantity: 3, unitCostMinor: 60000 }],
    }).expect(201);
  });

  test('storefront hides archived variants and returns linked variants for active product', async () => {
    const parentRes = await post('/variants', {
      name: 'Smart Watch',
      barcode: 'WATCH-ROOT',
      salePriceMinor: 1500000,
      size: '42mm',
      color: 'Silver',
    }).expect(201);
    const parentId = parentRes.body.id;

    const childRes = await post('/variants', {
      name: 'Smart Watch - Black',
      barcode: 'WATCH-BLACK',
      salePriceMinor: 1500000,
      size: '44mm',
      color: 'Black',
      parentId,
    }).expect(201);
    const childId = childRes.body.id;

    // Publish variants
    await ctx.db.query(
      'UPDATE variants SET published=true WHERE id IN ($1, $2)',
      [parentId, childId],
    );
    await approveTestProduct(ctx.db, parentId);
    await approveTestProduct(ctx.db, childId);

    // Query product detail on storefront
    const pubRes = await request(ctx.app.getHttpServer())
      .get(`/public/stores/${shopSlug}/products/${parentId}`)
      .expect(200);

    expect(pubRes.body.id).toBe(parentId);
    expect(pubRes.body.variants).toBeDefined();
    expect(pubRes.body.variants.length).toBeGreaterThanOrEqual(2);

    // Now archive child variant
    await put(`/variants/${childId}/archive`).expect(200);

    // Storefront detail of root product should no longer include archived child in variants
    const afterArchiveRes = await request(ctx.app.getHttpServer())
      .get(`/public/stores/${shopSlug}/products/${parentId}`)
      .expect(200);

    const groupVariantIds = afterArchiveRes.body.variants.map((v: any) => v.id);
    expect(groupVariantIds).not.toContain(childId);

    // Direct fetch of archived variant from storefront should return 404
    await request(ctx.app.getHttpServer())
      .get(`/public/stores/${shopSlug}/products/${childId}`)
      .expect(404);
  });
});
