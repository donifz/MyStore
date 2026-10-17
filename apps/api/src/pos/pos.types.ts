export type PaymentMethod = 'cash' | 'card';
export type CashTransactionType = 'in' | 'out';
export type CashTransactionView = {
  id: string;
  shopId: string;
  shiftId: string;
  actorId: string;
  type: CashTransactionType;
  amountMinor: number;
  reason: string;
  createdAt: string;
};
export type ShiftView = {
  id: string;
  shopId: string;
  actorId: string;
  status: 'open' | 'closed';
  salesCashMinor: number;
  salesCardMinor: number;
  refundsCashMinor: number;
  refundsCardMinor: number;
  cashInMinor: number;
  cashOutMinor: number;
  openingCashMinor: number;
  expectedCashMinor: number;
  actualCashMinor: number | null;
  discrepancyMinor: number | null;
  comment: string | null;
  openedAt: string;
  closedAt: string | null;
};
export type ReturnInput = {
  saleId: string;
  shiftId?: string;
  method?: PaymentMethod;
  refundMoney: boolean;
  reason: string;
  lines: {
    saleLineId: string;
    quantity: number;
    condition: 'resellable' | 'defective';
  }[];
};
export type ReturnResult = {
  id: string;
  kind: 'return';
  totalMinor: number;
  refundedMinor: number;
};
