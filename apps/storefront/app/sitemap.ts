import { publicApi, Page, Store } from '../lib/public-api';
import { publicBase } from '../lib/seo';
export const dynamic = 'force-dynamic';
export default async function sitemap() {
  const base = publicBase();
  const urls = [
    { url: base + '/' },
    { url: base + '/shops' },
    { url: base + '/terms' },
    { url: base + '/privacy' },
  ];
  let page = 1;
  while (true) {
    const stores = await publicApi<Page<Store>>(
      '/stores?page=' + page + '&pageSize=100',
    );
    urls.push(...stores.items.map((s) => ({ url: base + '/shops/' + s.slug })));
    if (page * 100 >= stores.total || !stores.items.length) break;
    page++;
  }
  return urls;
}
