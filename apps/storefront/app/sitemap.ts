import type { MetadataRoute } from 'next';
import { publicApi, Page, Store, Products } from '../lib/public-api';
import { publicBase } from '../lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicBase();
  const now = new Date();

  const urls: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${base}/catalog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/shops`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  try {
    let page = 1;
    while (page <= 20) {
      const stores = await publicApi<Page<Store>>(
        `/stores?page=${page}&pageSize=100`,
      );
      for (const s of stores.items) {
        urls.push({
          url: `${base}/shop/${s.slug}`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.8,
        });
      }
      if (page * 100 >= stores.total || !stores.items.length) break;
      page++;
    }
  } catch {
    // Keep base urls on API error
  }

  try {
    let page = 1;
    while (page <= 20) {
      const products = await publicApi<Products>(
        `/products?page=${page}&pageSize=100`,
      );
      for (const p of products.items) {
        if (p.store?.slug && p.id) {
          urls.push({
            url: `${base}/shop/${p.store.slug}/products/${p.id}`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
      if (page * 100 >= products.total || !products.items.length) break;
      page++;
    }
  } catch {
    // Keep urls on API error
  }

  return urls;
}
