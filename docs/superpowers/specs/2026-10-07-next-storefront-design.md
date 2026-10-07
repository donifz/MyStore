# Next.js public storefront

## Intent and authorization
The user asks to implement Next.js for the public storefront after learning the current public pages use Vite. Prior authorization delegates repository decisions and deployment within donifz/MyStore; native execution is retained. Success is complete meaningful public HTML without JavaScript, searchable store/product pages, same live inventory, and unchanged seller workflows.

## Architecture
Add apps/storefront with Next.js 16 App Router and server components. Keep apps/web for the seller SPA, NestJS and PostgreSQL for API/data. A Next custom request handler is mounted in Nest before routes only for public page paths, /_next assets, robots.txt and sitemap.xml. This keeps a single Node process and existing free Render service. Alternatives are a second Render web service (extra process/resource) and moving all seller UI to Next (unnecessary scope). One integrated service is selected.

SSR fetches only existing anonymous DTO APIs via trusted loopback address, never forwards cookies, and uses no-store and a 10-second timeout. No backend/database credentials reach client props. HTTP 404 is required for hidden/missing store/product; upstream failures show a retryable error, not empty results. Pages depend on runtime API data, not build-time databases.

## Public pages
Keep routes /, /shops, /shops/[slug], /shops/[slug]/products/[id], /partner and current visual design. Server render initial catalog/profile/product data. GET forms preserve query filters in URLs; normalize integers to page1..1000000, text lengths and sort allowlist. Pagination keeps a previous-page link when a page shrinks. Small client component refreshes via router.refresh every30 seconds and focus; refresh cannot navigate to an older filter URL. Partner registration remains a client form posting the existing API; seller links use ordinary anchors to transfer to Vite.

## SEO and privacy
Render descriptive titles and descriptions, canonical links excluding filters, and OpenGraph metadata. Filter/page URLs are noindex to avoid duplicate indexing. Product JSON-LD uses KGS, sale price and availability, escapes script boundaries, and contains only public DTO fields. robots excludes /seller and /api. Sitemap lists root, store directory and all published stores using paginated API lists; do not add a product sitemap endpoint in this migration. Base public URL comes from RENDER_EXTERNAL_URL or WEB_ORIGINS first trusted origin, never arbitrary request Host. Missing pages noindex. No public Vite fallback in production when Next is enabled.

## Delivery and verification
Pin currently available stable Next version16.4.0 after registry verification; Node24.19 supported. No new paid resources, migrations or env secrets. Update Docker to include Next runtime artifacts and make runtime writable cache owned by node. Test response HTML without JS, metadata, structured-data escaping, hidden404, shrinking pagination, upstream errors, routes/API bypass, fresh stock after changed API, sitemap and partner/seller browser flow. Full existing API/web tests and Docker/browser CI remain required before merge/deploy. Production checks are read-only; no demo registrations or products.
