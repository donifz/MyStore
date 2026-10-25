// Real Next HTTP responses backed by a controlled anonymous API boundary.
const { createServer } = require('node:http');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const id = '11111111-1111-4111-8111-111111111111';
const store = {
  slug: 'shop-a',
  name: 'Магазин у дома',
  description: 'Посуда',
  city: 'Ош',
  phone: '+996700123456',
  address: 'Центр',
  hours: '10–19',
  presentation: {
    id: 'new-year',
    startsAt: null,
    endsAt: null,
    hero: { title: 'Новогодние подарки', text: 'Праздничная подборка' },
  },
};
let available = 3,
  failed = false,
  hidden = false,
  malformedFilters = false;
const product = () => ({
  id,
  name: 'Керамическая чашка',
  description: '</script><script id="injected">bad()</script>',
  category: 'Посуда',
  salePriceMinor: 24000,
  available,
  store,
});
const seen = [];
(async () => {
  process.env.RENDER_EXTERNAL_URL = 'https://storefront.example.test';
  const dir = resolve('apps/storefront');
  const app = existsSync(resolve(dir, '.next/BUILD_ID'))
    ? require('next')({ dev: false, dir })
    : null;
  if (app) await app.prepare();
  const handler = app?.getRequestHandler();
  process.env.WEB_ORIGINS = 'https://storefront.example.test';
  process.env.SESSION_SECRET =
    'local-only-ssr-test-secret-at-least32characters';
  const nest = await require('../apps/api/dist/app.js').createApp(
    {},
    handler ? (req, res) => handler(req, res) : undefined,
  );
  await nest.init();
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/public/')) {
      seen.push(url);
      res.setHeader('content-type', 'application/json');
      if (failed) {
        res.statusCode = 503;
        return res.end('{"message":"unavailable"}');
      }
      if (url.pathname.includes('missing') || hidden) {
        res.statusCode = 404;
        return res.end('{"message":"not found"}');
      }
      let body;
      if (url.pathname === '/api/public/filters')
        body = malformedFilters
          ? store
          : {
              locations: [{ city: 'Ош', district: '' }],
              categories: ['Посуда'],
            };
      else if (url.pathname === '/api/public/products')
        body = {
          items: url.searchParams.get('page') === '2' ? [] : [product()],
          total: 1,
          page: Number(url.searchParams.get('page') || 1),
          pageSize: 24,
          categories: ['Посуда'],
        };
      else if (url.pathname === '/api/public/stores')
        body = { items: [store], total: 1, page: 1, pageSize: 100 };
      else if (url.pathname.endsWith('/products/' + id)) body = product();
      else if (
        url.pathname === '/api/public/stores/shop-a' ||
        url.pathname === '/api/public/stores/old-shop'
      )
        body = store;
      else {
        res.statusCode = 404;
        return res.end('{"message":"not found"}');
      }
      res.setHeader('cache-control', 'no-store');
      return res.end(JSON.stringify(body));
    }
    if (handler) return nest.getHttpAdapter().getInstance()(req, res);
    res.setHeader('content-type', 'text/html');
    res.end(readFileSync('apps/web/dist/index.html'));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.PORT = String(server.address().port);
  const base = 'http://127.0.0.1:' + process.env.PORT;
  const get = async (path) => {
    const response = await fetch(base + path);
    const html = await response.text();
    return { response, html, doc: new JSDOM(html).window.document };
  };
  try {
    const root = await get('/');
    assert.equal(root.response.status, 200);
    const heading = root.doc.querySelector('h1')?.textContent || '';
    assert(heading.includes('Товары рядом'));
    assert(heading.includes('от разных магазинов'));
    assert(root.doc.body.textContent.includes('Керамическая чашка'));
    assert(root.doc.body.textContent.includes('240'));
    assert(
      root.doc.querySelector('select[name="city"] option[value="Ош"]') ||
        [...root.doc.querySelectorAll('select[name="city"] option')].some(
          (option) => option.textContent === 'Ош',
        ),
    );
    malformedFilters = true;
    for (const path of ['/', '/shops']) {
      const malformed = await get(path);
      assert.equal(
        malformed.response.status,
        200,
        'Malformed filter metadata must not crash SSR',
      );
      assert(malformed.doc.querySelector('header'));
    }
    malformedFilters = false;
    assert.equal(
      root.doc.querySelector('link[rel="canonical"]')?.href,
      'https://storefront.example.test/',
    );
    const csp = root.response.headers.get('content-security-policy');
    const nonce = csp.match(/'nonce-([^']+)'/);
    assert(nonce, 'Next scripts require a per-request CSP nonce');
    for (const script of root.doc.querySelectorAll('script:not([src])'))
      assert.equal(script.getAttribute('nonce'), nonce[1]);
    const detail = await get('/shop/shop-a/products/' + id);
    assert.equal(detail.response.status, 200, detail.html.slice(0, 1000));
    assert.equal(
      detail.doc.querySelector('h1')?.textContent,
      'Керамическая чашка',
    );
    assert(detail.doc.body.textContent.includes('В наличии: 3 шт.'));
    assert(!detail.doc.querySelector('script#injected'));
    const schema = JSON.parse(
      detail.doc.querySelector('script[type="application/ld+json"]')
        .textContent,
    );
    assert.equal(schema.offers.priceCurrency, 'KGS');
    assert.equal(schema.offers.price, '240.00');
    assert.equal(schema.offers.availability, 'https://schema.org/InStock');
    assert(detail.doc.title.includes('Керамическая чашка'));
    assert(detail.doc.body.textContent.includes('Новогодние подарки'));
    const legacy = await fetch(base + '/shops/shop-a?category=Посуда', {
      redirect: 'manual',
    });
    assert.equal(legacy.status, 308);
    assert.equal(
      legacy.headers.get('location'),
      '/shop/shop-a?category=%D0%9F%D0%BE%D1%81%D1%83%D0%B4%D0%B0',
    );
    const historical = await fetch(base + '/shop/old-shop?q=чашка', {
      redirect: 'manual',
    });
    assert.equal(historical.status, 308);
    assert.equal(
      historical.headers.get('location'),
      '/shop/shop-a?q=%D1%87%D0%B0%D1%88%D0%BA%D0%B0',
    );
    assert.equal(
      detail.doc.querySelector('a[href^="tel:"]')?.getAttribute('href'),
      'tel:+996700123456',
    );
    delete store.phone;
    const noPhone = await get('/shops/shop-a/products/' + id);
    assert.equal(
      noPhone.doc.querySelector('a[href^="tel:"]'),
      null,
      'Absent phone must not create a broken contact link',
    );
    store.phone = '+996700123456';
    available = 0;
    const fresh = await get('/shops/shop-a/products/' + id);
    assert(fresh.doc.body.textContent.includes('Нет в наличии'));
    assert.equal(
      JSON.parse(
        fresh.doc.querySelector('script[type="application/ld+json"]')
          .textContent,
      ).offers.availability,
      'https://schema.org/OutOfStock',
    );
    const missing = await get('/shops/missing');
    assert.equal(missing.response.status, 404);
    hidden = true;
    assert.equal(
      (await get('/shops/shop-a/products/' + id)).response.status,
      404,
    );
    hidden = false;
    const paged = await get('/?page=2');
    assert(paged.doc.body.textContent.includes('На этой странице товаров нет'));
    assert(paged.doc.querySelector('a[aria-label="Предыдущая страница"]'));
    assert(
      paged.doc
        .querySelector('meta[name="robots"]')
        .content.includes('noindex'),
    );
    seen.length = 0;
    await get(
      '/?page=-3&sort=drop-table&q=' + encodeURIComponent('x'.repeat(200)),
    );
    let query = seen.find((x) => x.pathname === '/api/public/products');
    assert.equal(query.searchParams.get('page'), '1');
    assert.equal(query.searchParams.get('sort'), 'name');
    assert.equal(query.searchParams.get('q').length, 128);
    seen.length = 0;
    await get('/?sort=newest&q=SKU-100');
    let newestQuery = seen.find((x) => x.pathname === '/api/public/products');
    assert.equal(newestQuery.searchParams.get('sort'), 'newest');
    assert.equal(newestQuery.searchParams.get('q'), 'SKU-100');
    seen.length = 0;
    await get('/?category=' + 'c'.repeat(200));
    assert.equal(
      seen
        .find((x) => x.pathname === '/api/public/products')
        .searchParams.get('category').length,
      80,
    );
    seen.length = 0;
    await get('/?page=1.5');
    assert.equal(
      seen
        .find((x) => x.pathname === '/api/public/products')
        .searchParams.get('page'),
      '1',
    );
    seen.length = 0;
    await get('/?page=999999999');
    assert.equal(
      seen
        .find((x) => x.pathname === '/api/public/products')
        .searchParams.get('page'),
      '1000000',
    );
    failed = true;
    const outage = await get('/');
    assert(
      outage.doc.body.textContent.includes('Не удалось загрузить каталог'),
    );
    assert(
      !outage.doc.body.textContent.includes('Товары пока не опубликованы.'),
    );
    const kit = await get('/ui-kit');
    assert.equal(
      kit.response.status,
      200,
      'UI kit remains available during API outage',
    );
    assert(
      kit.doc.querySelector('meta[name="robots"]').content.includes('noindex'),
    );
    const kitNonce = kit.response.headers
      .get('content-security-policy')
      .match(/'nonce-([^']+)'/)[1];
    for (const script of kit.doc.querySelectorAll('script:not([src])'))
      assert.equal(
        script.getAttribute('nonce'),
        kitNonce,
        'UI-kit interactivity needs CSP nonce',
      );
    failed = false;
    const sitemap = await get('/sitemap.xml');
    assert(
      sitemap.html.includes('https://storefront.example.test/shop/shop-a'),
    );
    assert(!sitemap.html.includes('/seller'));
    assert(!sitemap.html.includes('/ui-kit'));
    const robots = await get('/robots.txt');
    assert(robots.html.includes('Disallow: /seller'));
    assert(robots.html.includes('Disallow: /api'));
    console.log(
      'SSR HTTP tests passed: anonymous HTML, metadata, safe JSON-LD, fresh stock, hidden404, pagination, bounded queries, outage, sitemap/robots',
    );
  } finally {
    await new Promise((r) => server.close(r));
    await nest.close();
    if (app) await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
