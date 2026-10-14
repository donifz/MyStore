import { publicBase } from '../lib/seo';
export const dynamic = 'force-dynamic';
export default function robots() {
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
        '/ui-kit',
      ],
    },
    sitemap: publicBase() + '/sitemap.xml',
  };
}
