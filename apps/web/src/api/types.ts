export type Role = 'owner' | 'manager' | 'cashier';
export type Shop = {
  id: string;
  name: string;
  role: Role;
  canReturn?: boolean;
  canViewReports?: boolean;
};
export function hasShopPermission(
  shop: Shop | undefined,
  permission: 'return' | 'reports',
) {
  return (
    !!shop &&
    (shop.role === 'owner' ||
      (permission === 'return'
        ? shop.canReturn === true
        : shop.canViewReports === true))
  );
}
export type Me = {
  userId: string;
  email: string;
  csrfToken: string;
  shops: Shop[];
  platformAdmin?: boolean;
};
export type Variant = {
  sku?: string;
  size?: string;
  color?: string;
  archived?: boolean;
  parentId?: string | null;
  photoUrl?: string;
  photoUrls?: string[];
  description?: string;
  category?: string;
  subcategory?: string;
  published?: boolean;
  publicationStatus?: 'pending' | 'approved' | 'unpublished';
  rejectionReason?: string;
  id: string;
  name: string;
  barcode: string;
  salePriceMinor: number;
  physical?: number;
  reserved?: number;
  available?: number;
  stockValueMinor?: number;
  lastPurchaseMinor?: number;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type Shift = {
  id: string;
  shopId: string;
  actorId: string;
  status: 'open' | 'closed';
  salesCashMinor: number;
  salesCardMinor: number;
  refundsCashMinor: number;
  refundsCardMinor: number;
  cashInMinor?: number;
  cashOutMinor?: number;
  openingCashMinor: number;
  expectedCashMinor: number;
  actualCashMinor: number | null;
  discrepancyMinor: number | null;
  comment: string | null;
  openedAt: string;
  closedAt: string | null;
};
export type CashTransaction = {
  id: string;
  shopId: string;
  shiftId: string;
  actorId: string;
  type: 'in' | 'out';
  amountMinor: number;
  reason: string;
  createdAt: string;
};
export type CurrentShift = Shift | { occupied: true } | null;
export type SaleSummary = {
  id: string;
  totalMinor: number;
  createdAt: string;
  shiftId: string | null;
  method: 'cash' | 'card' | null;
};
export type SaleDetail = SaleSummary & {
  lines: {
    id: string;
    variantId: string;
    name: string;
    barcode: string;
    quantity: number;
    returnedQuantity: number;
    unitPriceMinor: number;
    discountMinor?: number;
    discountReason?: string | null;
  }[];
};
export type PlatformFinancialGrant = {
  id: string;
  shopId: string;
  shopName: string;
  adminEmail: string;
  purpose: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
};
export type FinancialSummary = {
  from?: string;
  to?: string;
  revenueMinor: number;
  salesMinor: number;
  returnsMinor: number;
  returnsCount?: number;
  posSalesMinor?: number;
  posSalesCount?: number;
  onlineSalesMinor?: number;
  onlineSalesCount?: number;
  costOfGoodsMinor: number;
  grossProfitMinor: number;
  paymentsReceivedMinor: number;
  paymentsRefundedMinor: number;
  cashReceivedMinor: number;
  cardReceivedMinor: number;
  physicalUnits: number;
  reservedUnits: number;
  stockValueMinor: number;
  lowStockCount: number;
  openOrders: number;
  issuedOrders: number;
  issuedOrdersMinor?: number;
  closedShifts: number;
  cashDiscrepancyMinor: number;
  dailySeries?: {
    day: string;
    salesMinor: number;
    returnsMinor: number;
    netMinor: number;
    salesCount: number;
  }[];
  topProducts?: {
    id: string;
    name: string;
    category: string;
    quantitySold: number;
    revenueMinor: number;
    profitMinor: number;
  }[];
  categoryShare?: {
    category: string;
    revenueMinor: number;
    quantitySold: number;
  }[];
};
