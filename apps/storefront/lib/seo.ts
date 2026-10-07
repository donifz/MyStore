import type { Metadata } from 'next';
import { Product, priceDecimal } from './public-api';
export function publicBase() {
  return new URL(
    process.env.RENDER_EXTERNAL_URL ||
      process.env.WEB_ORIGINS?.split(',')[0] ||
      'http://localhost:3001',
  ).origin;
}
export function metadata(
  title: string,
  description: string,
  path: string,
  noindex = false,
): Metadata {
  const url = publicBase() + path;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: !noindex, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: 'MyStore',
      locale: 'ru_KG',
      type: 'website',
    },
  };
}
export function productJson(v: Product) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: v.name,
    description: v.description,
    category: v.category,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'KGS',
      price: priceDecimal(v.salePriceMinor),
      availability: v.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: publicBase() + `/shops/${v.store.slug}/products/${v.id}`,
      seller: { '@type': 'Organization', name: v.store.name },
    },
  }).replace(/</g, '\\u003c');
}
