import type { Metadata } from 'next';
import { Product, Store, priceDecimal } from './public-api';

export function publicBase() {
  return new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      process.env.WEB_ORIGINS?.split(',')[0] ||
      'http://localhost:3001',
  ).origin;
}

export type SeoOptions = {
  noindex?: boolean;
  image?: string;
  type?: 'website' | 'article';
  keywords?: string[];
};

export function metadata(
  title: string,
  description: string,
  path: string,
  noindexOrOptions: boolean | SeoOptions = false,
): Metadata {
  const options: SeoOptions =
    typeof noindexOrOptions === 'boolean'
      ? { noindex: noindexOrOptions }
      : (noindexOrOptions ?? {});

  const url = path.startsWith('http') ? path : publicBase() + path;
  const imageUrl = options.image
    ? options.image.startsWith('http')
      ? options.image
      : publicBase() + options.image
    : undefined;

  return {
    title,
    description,
    keywords: options.keywords,
    alternates: { canonical: url },
    robots: {
      index: !options.noindex,
      follow: true,
      googleBot: {
        index: !options.noindex,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'MyStore',
      locale: 'ru_KG',
      type: options.type || 'website',
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export function productJson(v: Product) {
  const images = (
    v.photoUrls?.length ? v.photoUrls : v.photoUrl ? [v.photoUrl] : []
  ).map((u) => (u.startsWith('http') ? u : publicBase() + u));

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: v.name,
    description: v.description || `${v.name} в магазине ${v.store.name}`,
    category: v.category || undefined,
    sku: v.sku || undefined,
    image: images.length > 0 ? images : undefined,
    brand: {
      '@type': 'Brand',
      name: v.store.name,
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'KGS',
      price: priceDecimal(v.salePriceMinor),
      itemCondition: 'https://schema.org/NewCondition',
      availability:
        v.available > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: publicBase() + `/shop/${v.store.slug}/products/${v.id}`,
      seller: {
        '@type': 'Organization',
        name: v.store.name,
      },
    },
  };

  if (v.ratingCount && v.ratingCount > 0 && v.ratingAverage) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(v.ratingAverage.toFixed(1)),
      reviewCount: v.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbsJson(items: { name: string; url: string }[]) {
  const base = publicBase();
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : base + item.url,
    })),
  }).replace(/</g, '\\u003c');
}

export function storeJson(s: Store) {
  const base = publicBase();
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: s.name,
    description: s.description || `Магазин ${s.name}, ${s.city}`,
    url: `${base}/shop/${s.slug}`,
    telephone: s.phone || undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: s.city,
      streetAddress: s.address || undefined,
      addressCountry: 'KG',
    },
  };

  if (s.ratingCount && s.ratingCount > 0 && s.ratingAverage) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(s.ratingAverage.toFixed(1)),
      reviewCount: s.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function websiteJson() {
  const base = publicBase();
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MyStore',
    url: base,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${base}/?q={search_term_string}#catalog`,
      },
      'query-input': 'required name=search_term_string',
    },
  }).replace(/</g, '\\u003c');
}

export function organizationJson() {
  const base = publicBase();
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MyStore',
    url: base,
    logo: `${base}/icon-512.png`,
    description: 'Платформа и маркетплейс местных магазинов Кыргызстана.',
  }).replace(/</g, '\\u003c');
}
