export type Role = 'owner' | 'manager' | 'cashier';
export type Shop = { id: string; name: string; role: Role };
export type Me = {
  userId: string;
  email: string;
  csrfToken: string;
  shops: Shop[];
};
export type Variant = {
  sku?: string;
  photoUrl?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  published?: boolean;
  id: string;
  name: string;
  barcode: string;
  salePriceMinor: number;
  physical?: number;
  reserved?: number;
  available?: number;
  stockValueMinor?: number;
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
  openingCashMinor: number;
  expectedCashMinor: number;
  actualCashMinor: number | null;
  discrepancyMinor: number | null;
  comment: string | null;
  openedAt: string;
  closedAt: string | null;
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
  }[];
};
