import { creditSalesEnabled } from './credit-feature';

describe('credit rollout default-off policy', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFlag = process.env.CREDIT_SALES_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    if (originalFlag === undefined) delete process.env.CREDIT_SALES_ENABLED;
    else process.env.CREDIT_SALES_ENABLED = originalFlag;
  });

  it('does not allow debt sales in production without explicit opt-in', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CREDIT_SALES_ENABLED;
    expect(creditSalesEnabled()).toBe(false);
    process.env.CREDIT_SALES_ENABLED = 'false';
    expect(creditSalesEnabled()).toBe(false);
  });

  it('allows deliberate opt-in, and testing before rollout', () => {
    process.env.NODE_ENV = 'production';
    process.env.CREDIT_SALES_ENABLED = 'true';
    expect(creditSalesEnabled()).toBe(true);
    process.env.NODE_ENV = 'test';
    delete process.env.CREDIT_SALES_ENABLED;
    expect(creditSalesEnabled()).toBe(true);
  });
});
