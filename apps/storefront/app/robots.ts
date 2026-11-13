import type { MetadataRoute } from 'next';
import { publicBase } from '../lib/seo';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = publicBase();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/seller',
        '/api',
        '/partner',
        '/favorites',
        '/cart',
        '/checkout',
        '/orders',
        '/profile',
        '/buyer',
        '/ui-kit',
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
