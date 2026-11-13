import { test, expect } from '@playwright/test';

test.describe('SEO and structured data', () => {
  test('robots.txt delivers correct directives', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('User-Agent: *');
    expect(body).toContain('Allow: /');
    expect(body).toContain('Disallow: /cart');
    expect(body).toContain('Disallow: /checkout');
    expect(body).toContain('Disallow: /orders');
    expect(body).toContain('Disallow: /buyer');
    expect(body).toContain('Sitemap:');
    expect(body).toContain('/sitemap.xml');
    expect(body).toContain('Host:');
  });

  test('sitemap.xml delivers valid sitemap with stores and products', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('/catalog</loc>');
    expect(body).toContain('/shops</loc>');
    expect(body).toContain('/shop/shop-a</loc>');
    expect(body).toContain(
      '/shop/shop-a/products/11111111-1111-4111-8111-111111111111</loc>',
    );
    expect(body).toContain('<changefreq>');
    expect(body).toContain('<priority>');
  });

  test('home page includes metadata, open graph and WebSite schema', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/MyStore/);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toContain('/');

    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(ogTitle).toContain('MyStore');

    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    expect(ogImage).toBeTruthy();

    const twitterCard = await page
      .locator('meta[name="twitter:card"]')
      .getAttribute('content');
    expect(twitterCard).toBe('summary_large_image');

    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allInnerTexts();
    const parsed = schemas.map((s) => JSON.parse(s));

    const websiteSchema = parsed.find((s) => s['@type'] === 'WebSite');
    expect(websiteSchema).toBeTruthy();
    expect(websiteSchema?.name).toBe('MyStore');
    expect(websiteSchema?.potentialAction?.['@type']).toBe('SearchAction');

    const orgSchema = parsed.find((s) => s['@type'] === 'Organization');
    expect(orgSchema).toBeTruthy();
    expect(orgSchema?.name).toBe('MyStore');
  });

  test('product page includes open graph image, Product schema and BreadcrumbList schema', async ({
    page,
  }) => {
    await page.goto(
      '/shop/shop-a/products/11111111-1111-4111-8111-111111111111',
    );

    await expect(page).toHaveTitle(/Керамическая чашка/);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toContain(
      '/shop/shop-a/products/11111111-1111-4111-8111-111111111111',
    );

    const ogType = await page
      .locator('meta[property="og:type"]')
      .getAttribute('content');
    expect(ogType).toBe('article');

    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allInnerTexts();
    const parsed = schemas.map((s) => JSON.parse(s));

    const productSchema = parsed.find((s) => s['@type'] === 'Product');
    expect(productSchema).toBeTruthy();
    expect(productSchema?.name).toBe('Керамическая чашка');
    expect(productSchema?.offers?.priceCurrency).toBe('KGS');
    expect(productSchema?.offers?.price).toBe('240.00');
    expect(productSchema?.offers?.seller?.name).toBe('Магазин у дома');

    const breadcrumbsSchema = parsed.find(
      (s) => s['@type'] === 'BreadcrumbList',
    );
    expect(breadcrumbsSchema).toBeTruthy();
    expect(breadcrumbsSchema?.itemListElement?.length).toBeGreaterThanOrEqual(
      4,
    );
  });

  test('shop page includes Store and BreadcrumbList schemas and canonical link', async ({
    page,
  }) => {
    await page.goto('/shop/shop-a');

    await expect(page).toHaveTitle(/Магазин у дома/);

    const canonical = await page
      .locator('link[rel="canonical"]')
      .getAttribute('href');
    expect(canonical).toContain('/shop/shop-a');

    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allInnerTexts();
    const parsed = schemas.map((s) => JSON.parse(s));

    const storeSchema = parsed.find((s) => s['@type'] === 'Store');
    expect(storeSchema).toBeTruthy();
    expect(storeSchema?.name).toBe('Магазин у дома');

    const breadcrumbsSchema = parsed.find(
      (s) => s['@type'] === 'BreadcrumbList',
    );
    expect(breadcrumbsSchema).toBeTruthy();
  });

  test('catalog page includes BreadcrumbList schema', async ({ page }) => {
    await page.goto('/catalog');

    await expect(page).toHaveTitle(/Каталог категорий/);

    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allInnerTexts();
    const parsed = schemas.map((s) => JSON.parse(s));

    const breadcrumbsSchema = parsed.find(
      (s) => s['@type'] === 'BreadcrumbList',
    );
    expect(breadcrumbsSchema).toBeTruthy();
  });
});
