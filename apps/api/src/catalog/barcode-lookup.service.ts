import { Injectable } from '@nestjs/common';

@Injectable()
export class BarcodeLookupService {
  async lookup(code: string) {
    // External catalog data is an untrusted suggestion, never a product record.
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_ru,brands,generic_name,generic_name_ru`,
        {
          redirect: 'error',
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'MyStore/1.0 (barcode product suggestions)' },
        },
      );
      if (!response.ok) return { source: 'none', found: false };
      const body = await response.json();
      if (body?.status !== 1 || !body.product)
        return { source: 'none', found: false };
      const p = body.product;
      const clean = (value: unknown, length: number) =>
        typeof value === 'string'
          ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, length)
          : '';
      const name = clean(p.product_name_ru || p.product_name, 200);
      if (!name) return { source: 'none', found: false };
      const brand = clean(p.brands, 120);
      const description = clean(p.generic_name_ru || p.generic_name, 2000);
      return { source: 'openfoodfacts', found: true, name, brand, description };
    } catch {
      return { source: 'none', found: false };
    }
  }
}
