const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const paths = [
  "apps/api/src/catalog/photo-assistant.service.ts",
  "apps/api/src/platform/admin-session.controller.ts",
  "apps/api/test/photo-assistant.e2e-spec.ts",
  "apps/storefront/components/storefront/ProductPhoto.tsx",
  "apps/storefront/e2e/storefront.spec.ts",
  "apps/web/src/catalog/CategoriesPage.test.tsx",
  "apps/web/src/catalog/CategoriesPage.tsx",
  "apps/web/src/catalog/PhotoAssistant.tsx",
  "apps/web/src/platform/AdminPage.test.tsx",
  "apps/web/src/platform/AdminPage.tsx",
  "apps/web/src/staff/StaffPage.test.tsx",
  "apps/web/src/staff/StaffPage.tsx",
  "apps/api/src/platform/platform-admin.service.ts"
];
execFileSync(process.execPath, ['node_modules/prettier/bin/prettier.cjs', '--write', ...paths], { stdio: 'inherit' });
for (let i = 0; i < paths.length; i++) {
  const encoded = JSON.stringify(readFileSync(paths[i], 'utf8'));
  for (let j = 0; j < encoded.length; j += 2000) {
    console.log('PR105F:' + i + ':' + (j / 2000) + ':' + encoded.slice(j, j + 2000));
  }
}
