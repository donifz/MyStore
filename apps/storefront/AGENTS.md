<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Storefront UI rules

These rules apply to every file under apps/storefront and supplement the root AGENTS.md.

- Read docs/ui-kit.md before changing UI. Use components/ui and components/storefront before creating equivalent markup.
- Use --sf-* tokens from styles/tokens.css and sf-* CSS classes. Add new colors, spacing or radii to the tokens and guide together; do not scatter literal values through page markup.
- Import storefront CSS only from app/layout.tsx. Never import apps/web/src/styles.css into this app.
- Button defaults to type=button; form submission must explicitly use type=submit. Navigation uses Link/LinkButton with real href values.
- Fields require unique ids, visible labels and linked hint/error messages. Preserve focus-visible, disabled/loading/error states, 44 px controls and reduced-motion support.
- Cards use article containers with separate product, store, favorite and buy controls. Never nest interactive controls inside links.
- Product/Store types and formatSom come from lib/public-api.ts. Keep money in integer minor units. Never invent discounts or stock urgency.
- Keep pages and presentation components server-side unless state, effects or event handlers require use client.
- Preserve the multi-store cart, per-store immutable pending payloads and checkout keys, partial success, recovery, and legacy checkout migration when changing markup.
- Hide unavailable phone actions instead of producing broken tel links. Cover missing images, long names, unavailable stock, API errors and empty results.
- Keep /ui-kit demonstrations independent of API, checkout and cart writes. Preserve noindex and exclude the route from sitemap.
- Verify at 320, 390, 768 and 1440 px, with keyboard navigation and no horizontal overflow. Run storefront Playwright checks for UI changes.
- Follow root formatting, typecheck, build, relevant test and GitHub Actions requirements. Never claim an unrun check passed.
