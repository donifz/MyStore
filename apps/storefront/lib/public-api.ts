import { cache } from 'react';
export type Store = {
  district?: string;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;
  productCount?: number;
  categories?: string[];
  slug: string;
  name: string;
  description: string;
  city: string;
  address?: string;
  phone?: string;
  hours?: string;
};
export type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  size?: string;
  color?: string;
  salePriceMinor: number;
  available: number;
};
export type Product = {
  size?: string;
  color?: string;
  sku?: string;
  photoUrl?: string;
  photoUrls?: string[];
  id: string;
  name: string;
  description: string;
  category: string;
  salePriceMinor: number;
  available: number;
  store: Store;
  variants?: ProductVariant[];
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
  const sort = ['name', 'price-asc', 'price-desc', 'newest'].includes(
    first('sort'),
  )
    ? first('sort')
    : 'name';
  const params = new URLSearchParams({
    q: first('q').slice(0, 128),
    city: first('city').slice(0, 80),
    category: first('category').slice(0, 80),
    sort,
    inStock: String(first('inStock') === 'true'),
    page: String(page),
  });
  for (const key of ['minPrice', 'maxPrice']) {
    const v = first(key);
    if (/^\d{1,10}(\.\d{1,2})?$/.test(v))
      params.set(key, String(Math.round(Number(v) * 100)));
  }
  if (store) params.set('store', store);
  return {
    params,
    page,
    city: first('city'),
    minPrice: first('minPrice'),
    maxPrice: first('maxPrice'),
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

export type PublicFilters = {
  locations: { city: string; district: string }[];
  categories: string[];
};
// Filter metadata is optional for navigation. A stale or malformed response
// must never take down the storefront shell with an undefined .map().
export const publicFilters = cache(async (): Promise<PublicFilters> => {
  const data = await publicApi<unknown>('/filters');
  const value =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    locations: Array.isArray(value.locations)
      ? value.locations.flatMap((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return [];
          const location = entry as Record<string, unknown>;
          return typeof location.city === 'string' && location.city.trim()
            ? [
                {
                  city: location.city,
                  district:
                    typeof location.district === 'string'
                      ? location.district
                      : '',
                },
              ]
            : [];
        })
      : [],
    categories: Array.isArray(value.categories)
      ? value.categories.filter(
          (entry: unknown): entry is string =>
            typeof entry === 'string' && Boolean(entry.trim()),
        )
      : [],
  };
});
