import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import { EventEmailService } from '../src/email/event-email.service';
describe('event email recipients', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries');
  });
  afterEach(async () => teardown(c));
  it('expands eligible events once, skips historical events and respects owner opt-out', async () => {
    await c.db.query(
      'INSERT INTO outbox_events(shop_id,topic,entity_id,payload,email_dispatch_enabled) VALUES($1,\'product.moderation\',gen_random_uuid(),\'{"status":"approved"}\',false),($1,\'product.moderation\',gen_random_uuid(),\'{"status":"rejected"}\',true)',
      [fixture.shop],
    );
    const service = new EventEmailService(
      c.db,
      new (require('../src/email/email-queue.service').EmailQueueService)(c.db),
    );
    await Promise.all([service.expandBatch(), service.expandBatch()]);
    expect(await c.db.query('SELECT recipient FROM email_deliveries')).toEqual([
      { recipient: 'owner@example.test' },
    ]);
    await c.db.query(
      'INSERT INTO email_preferences(shop_id,user_id,moderation) VALUES($1,$2,false)',
      [fixture.shop, fixture.owner],
    );
    await c.db.query(
      'INSERT INTO outbox_events(shop_id,topic,payload) VALUES($1,\'product.moderation\',\'{"status":"approved"}\')',
      [fixture.shop],
    );
    await service.expandBatch();
    expect(
      (await c.db.query('SELECT count(*)::int n FROM email_deliveries'))[0].n,
    ).toBe(1);
  });
  it('does not starve valid events behind unsupported event statuses', async () => {
    await c.db.query(
      'INSERT INTO outbox_events(shop_id,topic,payload) SELECT $1,\'order.status\',\'{"status":"unsupported"}\'::jsonb FROM generate_series(1,20)',
      [fixture.shop],
    );
    await c.db.query(
      'INSERT INTO outbox_events(shop_id,topic,payload) VALUES($1,\'product.moderation\',\'{"status":"approved"}\')',
      [fixture.shop],
    );
    const service = c.app.get(EventEmailService);
    await service.expandBatch();
    await service.expandBatch();
    expect(
      (await c.db.query('SELECT count(*)::int n FROM email_deliveries'))[0].n,
    ).toBe(1);
  });
  it('quarantines a malformed recipient without rolling back unrelated valid deliveries', async () => {
    await c.db.query("UPDATE users SET email='invalid-email' WHERE id=$1", [
      fixture.owner,
    ]);
    await c.db.query(
      `INSERT INTO online_orders(id,shop_id,checkout_hash,fingerprint,store_name,name,phone,fulfillment,address,comment,total_minor,expires_at,email) VALUES(gen_random_uuid(),$1,'hash','fingerprint','Shop','Buyer','996700000000','pickup','','',0,now()+interval '30 minutes','buyer@example.test')`,
      [fixture.shop],
    );
    await c.app.get(EventEmailService).expandBatch();
    expect(await c.db.query('SELECT recipient FROM email_deliveries')).toEqual([
      { recipient: 'buyer@example.test' },
    ]);
    expect(
      (
        await c.db.query(
          "SELECT last_error FROM outbox_events WHERE topic='order.status'",
        )
      )[0].last_error,
    ).toContain('Invalid recipient');
  });
});
