import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { ShopAccessService } from '../src/shops/shop-access.service';
import { setup, teardown, fixture } from './helpers';

describe('individual staff permissions', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const root = `/shops/${fixture.shop}`;
  const permissions = `${root}/staff/${fixture.cashier}/permissions`;
  const denied = { canReturn: false, canViewReports: false };
  const granted = { canReturn: true, canViewReports: true };
  const post = (
    path: string,
    body: object,
    token = c.owner,
    key = randomUUID(),
  ) =>
    request(c.app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(body);
  const get = (path: string, token = c.cashier) =>
    request(c.app.getHttpServer()).get(path).auth(token, { type: 'bearer' });
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });

  it('grants reports independently, exposes current permissions, revokes on the same session', async () => {
    await get(root + '/reports/summary').expect(403);
    await get(root + '/reports/export/stock.csv').expect(403);
    const variant = (
      await post(root + '/variants', {
        name: 'Bag',
        salePriceMinor: 200,
      }).expect(201)
    ).body.id;
    await post(root + '/receivings', {
      lines: [{ variantId: variant, quantity: 3, unitCostMinor: 70 }],
    }).expect(201);
    expect((await get(root + '/stock/' + variant)).body).not.toHaveProperty(
      'stockValueMinor',
    );
    await post(permissions, { ...denied, canViewReports: true }).expect(201);
    expect((await get('/auth/me')).body.shops[0]).toMatchObject({
      canReturn: false,
      canViewReports: true,
    });
    expect(
      (await get(root + '/staff', c.owner)).body.members.find(
        (m: any) => m.id === fixture.cashier,
      ),
    ).toMatchObject({ canReturn: false, canViewReports: true });
    const summary = await get(root + '/reports/summary').expect(200);
    expect(summary.body.stockValueMinor).toBe(210);
    await get(root + '/reports/export/stock.csv').expect(200);
    expect((await get(root + '/stock/' + variant)).body.stockValueMinor).toBe(
      210,
    );
    expect((await get(root + '/variants')).body.items[0].stockValueMinor).toBe(
      210,
    );
    await get(root + '/access?permission=return').expect(403);
    await post(permissions, denied).expect(201);
    await get(root + '/reports/summary').expect(403);
    await get(root + '/reports/export/stock.csv').expect(403);
    expect((await get(root + '/stock/' + variant)).body).not.toHaveProperty(
      'stockValueMinor',
    );
    expect((await get(root + '/variants')).body.items[0]).not.toHaveProperty(
      'stockValueMinor',
    );
    await get(root + '/reports/summary', c.owner).expect(200);
  });

  it('allows returns across shop sales without costs, enforces own shift, retries, and revocation', async () => {
    const variant = (
      await post(root + '/variants', {
        name: 'Bag',
        salePriceMinor: 200,
      }).expect(201)
    ).body.id;
    await post(root + '/receivings', {
      lines: [{ variantId: variant, quantity: 3, unitCostMinor: 70 }],
    }).expect(201);
    const shift = (
      await post(root + '/pos/shifts', { openingCashMinor: 1000 }).expect(201)
    ).body.id;
    const sale = (
      await post(root + '/pos/sales', {
        shiftId: shift,
        method: 'cash',
        lines: [
          { variantId: variant, quantity: 2, expectedUnitPriceMinor: 200 },
        ],
      }).expect(201)
    ).body.id;
    const detailPath = root + '/pos/sales/' + sale;
    await get(detailPath).expect(403);
    await post(permissions, { ...denied, canReturn: true }).expect(201);
    const detail = await get(detailPath).expect(200);
    expect(JSON.stringify(detail.body)).not.toMatch(
      /costMinor|stockValueMinor/,
    );
    expect((await get(root + '/pos/sales')).body.total).toBe(1);
    const body = {
      saleId: sale,
      refundMoney: true,
      shiftId: shift,
      method: 'cash',
      reason: 'Возврат',
      lines: [
        {
          saleLineId: detail.body.lines[0].id,
          quantity: 1,
          condition: 'resellable',
        },
      ],
    };
    await post(root + '/pos/returns', body, c.cashier).expect(403);
    await post(root + '/pos/shifts/' + shift + '/close', {
      actualCashMinor: 1400,
      comment: '',
    }).expect(201);
    const ownShift = (
      await post(
        root + '/pos/shifts',
        { openingCashMinor: 1000 },
        c.cashier,
      ).expect(201)
    ).body.id;
    const key = randomUUID();
    const ret = { ...body, shiftId: ownShift };
    const responses = await Promise.all([
      post(root + '/pos/returns', ret, c.cashier, key),
      post(root + '/pos/returns', ret, c.cashier, key),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect((await get(root + '/stock/' + variant, c.owner)).body).toMatchObject(
      { physical: 2, stockValueMinor: 140 },
    );
    expect(
      (await get(root + '/pos/shifts/current')).body.expectedCashMinor,
    ).toBe(800);
    expect(
      (
        await c.db.query(
          "SELECT count(*)::int n FROM payment_records WHERE kind='refund'",
        )
      )[0].n,
    ).toBe(1);
    expect(
      (await c.db.query('SELECT count(*)::int n FROM return_lines'))[0].n,
    ).toBe(1);
    await get(root + '/reports/summary').expect(403);
    await post(permissions, denied).expect(201);
    await post(root + '/pos/returns', ret, c.cashier, key).expect(403);
    await post(root + '/pos/returns', ret, c.cashier).expect(403);
    await get(detailPath).expect(403);
    expect(
      (await c.db.query('SELECT count(*)::int n FROM return_lines'))[0].n,
    ).toBe(1);
  });

  it('allows only owner, validates both booleans and isolates shops', async () => {
    await post(permissions, granted, c.cashier).expect(403);
    await c.db.query("UPDATE memberships SET role='manager' WHERE user_id=$1", [
      fixture.cashier,
    ]);
    await post(permissions, granted, c.cashier).expect(403);
    await post(
      `/shops/${fixture.otherShop}/staff/${fixture.cashier}/permissions`,
      granted,
    ).expect(403);
    await post(`${root}/staff/${fixture.owner}/permissions`, denied).expect(
      403,
    );
    await post(permissions, { canReturn: true }).expect(400);
    await post(permissions, {
      canReturn: 'true',
      canViewReports: false,
    }).expect(400);
    await post(permissions, { ...granted, role: 'owner' }).expect(400);
    await post(permissions, granted).expect(201);
    await get(root + '/reports/summary').expect(200);
    await get(`/shops/${fixture.otherShop}/reports/summary`).expect(403);
    await get(`/shops/${fixture.otherShop}/pos/sales`).expect(403);
    await post(`${root}/staff/${fixture.cashier}/role`, {
      role: 'cashier',
    }).expect(201);
    await get(root + '/reports/summary').expect(403);
  });

  it('records before/after audit once, rejects key reuse and rolls back on audit failure', async () => {
    const key = randomUUID();
    await post(permissions, granted, c.owner, key).expect(201);
    await post(permissions, granted, c.owner, key).expect(201);
    await post(permissions, denied, c.owner, key).expect(409);
    const rows = await c.db.query(
      "SELECT * FROM audit_log WHERE action='staff:permissions'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      shop_id: fixture.shop,
      actor_id: fixture.owner,
      entity_id: fixture.cashier,
      details: { before: denied, after: granted },
    });
    await c.db.query(
      "CREATE FUNCTION test_permissions_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='staff:permissions' THEN RAISE EXCEPTION 'audit fail'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_permissions BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_permissions_fail()",
    );
    try {
      await post(permissions, denied).expect(500);
      await get(root + '/reports/summary').expect(200);
    } finally {
      await c.db.query(
        'DROP TRIGGER fail_permissions ON audit_log; DROP FUNCTION test_permissions_fail()',
      );
    }
    await post(permissions, denied).expect(201);
    await post(permissions, granted, c.owner, key).expect(201);
    await get(root + '/reports/summary').expect(403);
  });
  it.each([false, true])(
    'rechecks permission after concurrent revocation, cached retry=%s',
    async (cached) => {
      const variant = (
        await post(root + '/variants', {
          name: 'Bag',
          salePriceMinor: 200,
        }).expect(201)
      ).body.id;
      await post(root + '/receivings', {
        lines: [{ variantId: variant, quantity: 2, unitCostMinor: 70 }],
      }).expect(201);
      const sale = (
        await post(root + '/sales', {
          lines: [
            { variantId: variant, quantity: 1, expectedUnitPriceMinor: 200 },
          ],
        }).expect(201)
      ).body.id;
      await post(permissions, { ...denied, canReturn: true }).expect(201);
      const detail = await get(root + '/pos/sales/' + sale).expect(200);
      const key = randomUUID();
      const body = {
        saleId: sale,
        refundMoney: false,
        reason: 'Возврат',
        lines: [
          {
            saleLineId: detail.body.lines[0].id,
            quantity: 1,
            condition: 'resellable',
          },
        ],
      };
      if (cached)
        await post(root + '/pos/returns', body, c.cashier, key).expect(201);
      const access = c.app.get(ShopAccessService);
      const original = access.requireMembership.bind(access);
      let reached!: () => void, resume!: () => void;
      const waiting = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      let pause = true;
      const spy = jest
        .spyOn(access, 'requireMembership')
        .mockImplementation(async (...args) => {
          const result = await original(...args);
          if (pause && args[2] === 'return' && !args[3]) {
            pause = false;
            reached();
            await gate;
          }
          return result;
        });
      const pending = post(root + '/pos/returns', body, c.cashier, key).then(
        (r) => r,
      );
      try {
        await waiting;
        await post(permissions, denied).expect(201);
      } finally {
        resume();
      }
      try {
        expect((await pending).status).toBe(403);
        expect(
          (await c.db.query('SELECT count(*)::int n FROM return_lines'))[0].n,
        ).toBe(cached ? 1 : 0);
        expect(
          (await get(root + '/stock/' + variant, c.owner)).body,
        ).toMatchObject({
          physical: cached ? 2 : 1,
          stockValueMinor: cached ? 140 : 70,
        });
      } finally {
        spy.mockRestore();
      }
    },
  );

  it('migrates down/up without losing existing memberships or their roles', async () => {
    await c.db.undoLastMigration();
    try {
      expect(
        (
          await c.db.query(
            'SELECT role FROM memberships WHERE shop_id=$1 AND user_id=$2',
            [fixture.shop, fixture.cashier],
          )
        )[0].role,
      ).toBe('cashier');
    } finally {
      await c.db.runMigrations();
    }
    expect((await get('/auth/me')).body.shops[0]).toMatchObject(denied);
    await get(root + '/reports/summary', c.owner).expect(200);
  });
});
