import { cache } from 'react';
export type Store = {
  slug: string;
  name: string;
  description: string;
  city: string;
  address?: string;
  phone?: string;
  hours?: string;
};
export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  salePriceMinor: number;
  available: number;
  store: Store;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type Products = Page<Product> & { categories: string[] };
export type Search = Record<string, string | string[] | undefined>;
export class PublicApiError extends Error {
  constructor(public status: number) {
    super('Public API unavailable');
  }
}
export const publicApi = cache(async <T>(path: string): Promise<T> => {
  const response = await fetch(
    `http://127.0.0.1:${process.env.PORT || 3001}/api/public${path}`,
    { cache: 'no-store', signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new PublicApiError(response.status);
  return response.json() as Promise<T>;
});
export function query(search: Search, store?: string) {
  const first = (key: string) => {
    const v = search[key];
    return typeof v === 'string' ? v : Array.isArray(v) ? v[0] || '' : '';
  };
  const n = Number(first('page'));
  const page = Number.isInteger(n) && n >= 1 ? Math.min(n, 1000000) : 1;
  const sort = ['name', 'price-asc', 'price-desc'].includes(first('sort'))
    ? first('sort')
    : 'name';
  const params = new URLSearchParams({
    q: first('q').slice(0, 128),
    category: first('category').slice(0, 80),
    sort,
    inStock: String(first('inStock') === 'true'),
    page: String(page),
  });
  if (store) params.set('store', store);
  return {
    params,
    page,
    q: params.get('q')!,
    category: params.get('category')!,
    sort,
    inStock: params.get('inStock') === 'true',
  };
}
export function formatSom(minor: number) {
  return new Intl.NumberFormat('ru-KG', {
    style: 'currency',
    currency: 'KGS',
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export function priceDecimal(minor: number) {
  const n = BigInt(minor);
  return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
}
