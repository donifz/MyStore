import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { hashPassword } from '../src/auth/password';
import { setup, teardown, fixture, approveTestProduct } from './helpers';

describe('reports and platform management', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let adminToken: string;
  let slug: string;
  const root = `/shops/${fixture.shop}`;

  beforeAll(async () => {
    ctx = await setup(createApp);

    // Setup shop as published
    const [[s]] = await ctx.db.query(
      'UPDATE shops SET published=true,city=$2,phone=$3 WHERE id=$1 RETURNING slug',
      [fixture.shop, 'Бишкек', '+996555112233'],
    );
    slug = s.slug;

    // Create platform admin
    const adminId = randomUUID();
    await ctx.db.query(
      'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
      [
        adminId,
        'admin-reports@example.test',
        await hashPassword('admin-password'),
      ],
    );
    await ctx.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      adminId,
    ]);
    const login = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin-reports@example.test', password: 'admin-password' })
      .expect(201);
    adminToken = login.body.token;
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

  const get = (path: string, token = ctx.owner) =>
    request(ctx.app.getHttpServer())
      .get(root + path)
      .auth(token, { type: 'bearer' });

  test('order issued_at timing, channel separation in financial reports and exports', async () => {
    // 1. Create a product variant and receive 10 units
    const prodRes = await post('/variants', {
      name: 'Channel Test Shirt',
      barcode: 'CHAN-001',
      salePriceMinor: 80000, // 800 Som
    }).expect(201);
    const vId = prodRes.body.id;
    await approveTestProduct(ctx.db, vId);

    await post('/receivings', {
      lines: [{ variantId: vId, quantity: 10, unitCostMinor: 40000 }],
    }).expect(201);

    // 2. Place an online order on storefront
    const orderRes = await request(ctx.app.getHttpServer())
      .post('/public/orders')
      .set('origin', 'http://localhost:5173')
      .send({
        checkoutKey: randomUUID(),
        storeSlug: slug,
        name: 'Aibek',
        phone: '+996555112233',
        fulfillment: 'pickup',
        address: '',
        comment: '',
        lines: [{ variantId: vId, quantity: 2, expectedUnitPriceMinor: 80000 }],
      })
      .expect(201);

    const orderId = orderRes.body.id;
    expect(orderId).toBeDefined();

    // Summary before issue: issuedOrders is 0 (order is created, but not issued)
    const beforeSummary = await get('/reports/summary').expect(200);
    const initIssuedOrders = beforeSummary.body.issuedOrders;

    // Confirm and prepare order
    await post(`/orders/${orderId}/status`, { status: 'confirmed' }).expect(
      201,
    );
    await post(`/orders/${orderId}/status`, { status: 'ready' }).expect(201);

    // Open shift
    const shiftRes = await post('/pos/shifts', { openingCashMinor: 0 }).expect(
      201,
    );
    const shiftId = shiftRes.body.id;

    // Issue order via POS cash
    await post(`/orders/${orderId}/issue`, {
      shiftId,
      method: 'cash',
    }).expect(201);

    // Now summary: issuedOrders increased by 1, onlineSalesMinor is 160000 (2 * 800)
    const afterIssueSummary = await get('/reports/summary').expect(200);
    expect(afterIssueSummary.body.issuedOrders).toBe(initIssuedOrders + 1);
    expect(afterIssueSummary.body.onlineSalesMinor).toBe(160000);
    expect(afterIssueSummary.body.onlineSalesCount).toBe(1);

    // 3. Perform direct POS sale (offline in-store)
    await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [{ variantId: vId, quantity: 1, expectedUnitPriceMinor: 80000 }],
    }).expect(201);

    // Verify channel separation in summary
    const afterPosSummary = await get('/reports/summary').expect(200);
    expect(afterPosSummary.body.posSalesMinor).toBe(80000);
    expect(afterPosSummary.body.posSalesCount).toBe(1);
    expect(afterPosSummary.body.onlineSalesMinor).toBe(160000);
    expect(afterPosSummary.body.onlineSalesCount).toBe(1);
    expect(afterPosSummary.body.salesMinor).toBe(240000);

    // 4. Check CSV exports
    const salesCsv = await get('/reports/export/sales.csv').expect(200);
    expect(salesCsv.text).toContain('channel');
    expect(salesCsv.text).toContain('online');
    expect(salesCsv.text).toContain('pos');

    const ordersCsv = await get('/reports/export/orders.csv').expect(200);
    expect(ordersCsv.text).toContain('issued_at');

    // Close shift
    await post(`/pos/shifts/${shiftId}/close`, {
      actualCashMinor: 240000,
    }).expect(201);
  });

  test('marketplace blocking hides shop and products, rejects online orders, but preserves POS and seller access', async () => {
    // 1. Admin blocks marketplace for shop
    const blockRes = await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${fixture.shop}/marketplace-status`)
      .auth(adminToken, { type: 'bearer' })
      .send({ blocked: true, reason: 'Неоплата подписки за октябрь' })
      .expect(201);

    expect(blockRes.body.marketplaceBlocked).toBe(true);
    expect(blockRes.body.marketplaceBlockReason).toBe(
      'Неоплата подписки за октябрь',
    );

    // Overview reflects blocking
    const overview = await request(ctx.app.getHttpServer())
      .get('/platform/admin/overview')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);

    const shopItem = overview.body.shops.find(
      (s: any) => s.id === fixture.shop,
    );
    expect(shopItem.marketplaceBlocked).toBe(true);
    expect(shopItem.marketplaceBlockReason).toBe(
      'Неоплата подписки за октябрь',
    );

    // 2. Storefront hides store and products
    await request(ctx.app.getHttpServer())
      .get(`/public/stores/${slug}`)
      .expect(404);

    const storesList = await request(ctx.app.getHttpServer())
      .get('/public/stores')
      .expect(200);
    expect(storesList.body.items.some((s: any) => s.slug === slug)).toBe(false);

    // Attempting to place online order is blocked (403)
    const orderBlock = await request(ctx.app.getHttpServer())
      .post('/public/orders')
      .set('origin', 'http://localhost:5173')
      .send({
        checkoutKey: randomUUID(),
        storeSlug: slug,
        name: 'Klient',
        phone: '+996555998877',
        fulfillment: 'pickup',
        address: '',
        comment: '',
        lines: [
          {
            variantId: randomUUID(),
            quantity: 1,
            expectedUnitPriceMinor: 1000,
          },
        ],
      })
      .expect(403);
    expect(orderBlock.body.message).toContain(
      'Приём онлайн-заказов временно приостановлен',
    );

    // 3. Seller still has access to cabinet reports and documents
    await get('/reports/summary').expect(200);
    await get('/orders').expect(200);

    // 4. Seller can still open shift and sell locally via POS
    const shiftRes = await post('/pos/shifts', { openingCashMinor: 0 }).expect(
      201,
    );
    const shiftId = shiftRes.body.id;

    // Create item for sale
    const vRes = await post('/variants', {
      name: 'Local Cash Register Item',
      barcode: 'LOCAL-001',
      salePriceMinor: 50000,
    }).expect(201);
    await post('/receivings', {
      lines: [{ variantId: vRes.body.id, quantity: 5, unitCostMinor: 20000 }],
    }).expect(201);

    // Sale succeeds!
    await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [
        { variantId: vRes.body.id, quantity: 1, expectedUnitPriceMinor: 50000 },
      ],
    }).expect(201);

    await post(`/pos/shifts/${shiftId}/close`, {
      actualCashMinor: 50000,
    }).expect(201);

    // 5. Admin unblocks marketplace
    const unblockRes = await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${fixture.shop}/marketplace-status`)
      .auth(adminToken, { type: 'bearer' })
      .send({ blocked: false })
      .expect(201);

    expect(unblockRes.body.marketplaceBlocked).toBe(false);

    // Store is accessible on storefront again
    await request(ctx.app.getHttpServer())
      .get(`/public/stores/${slug}`)
      .expect(200);
  });

  test('manual subscription management and audit logging', async () => {
    const untilDate = '2026-12-31T23:59:59.999Z';
    const subRes = await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${fixture.shop}/subscription`)
      .auth(adminToken, { type: 'bearer' })
      .send({ until: untilDate })
      .expect(201);

    expect(new Date(subRes.body.subscriptionUntil).toISOString()).toBe(
      new Date(untilDate).toISOString(),
    );

    // Check overview
    const overview = await request(ctx.app.getHttpServer())
      .get('/platform/admin/overview')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);

    const shopItem = overview.body.shops.find(
      (s: any) => s.id === fixture.shop,
    );
    expect(new Date(shopItem.subscriptionUntil).toISOString()).toBe(
      new Date(untilDate).toISOString(),
    );

    // Remove subscription limit
    const clearRes = await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${fixture.shop}/subscription`)
      .auth(adminToken, { type: 'bearer' })
      .send({ until: null })
      .expect(201);

    expect(clearRes.body.subscriptionUntil).toBeNull();
  });

  test('platform admin can reset a shop owner password without email', async () => {
    const orphanShopId = randomUUID();
    await ctx.db.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
      orphanShopId,
      'Магазин без владельца',
    ]);
    const overview = await request(ctx.app.getHttpServer())
      .get('/platform/admin/overview')
      .auth(adminToken, { type: 'bearer' })
      .expect(200);
    expect(
      overview.body.shops.find((s: any) => s.id === fixture.shop).hasOwner,
    ).toBe(true);
    expect(
      overview.body.shops.find((s: any) => s.id === orphanShopId).hasOwner,
    ).toBe(false);

    await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${fixture.shop}/reset-owner-password`)
      .auth(ctx.owner, { type: 'bearer' })
      .expect(403);

    const reset = await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${fixture.shop}/reset-owner-password`)
      .auth(adminToken, { type: 'bearer' })
      .expect(201);

    expect(reset.body.shopId).toBe(fixture.shop);
    expect(reset.body.email).toBe('owner@example.test');
    expect(reset.body.temporaryPassword).toHaveLength(32);

    await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'owner@example.test',
        password: 'correct-test-password',
      })
      .expect(401);
    await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'owner@example.test',
        password: reset.body.temporaryPassword,
      })
      .expect(201);

    const audit = await ctx.db.query(
      `SELECT details FROM audit_log
       WHERE shop_id=$1 AND action='platform:owner-password-reset'`,
      [fixture.shop],
    );
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(reset.body.temporaryPassword);

    await request(ctx.app.getHttpServer())
      .post(`/platform/admin/shops/${orphanShopId}/reset-owner-password`)
      .auth(adminToken, { type: 'bearer' })
      .expect(404);

    await request(ctx.app.getHttpServer())
      .post(
        '/platform/admin/shops/99999999-9999-4999-8999-999999999999/reset-owner-password',
      )
      .auth(adminToken, { type: 'bearer' })
      .expect(404);
  });
});
