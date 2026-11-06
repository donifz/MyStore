/**
 * Production credit checkout is opt-in until both the sale and repayment
 * releases have passed the production rollout checks. Local tests and
 * development builds remain enabled to exercise the complete flow.
 */
export function creditSalesEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' ||
    process.env.CREDIT_SALES_ENABLED === 'true';
}
