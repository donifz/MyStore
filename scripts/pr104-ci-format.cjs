// Temporary CI formatting bridge for PR #104; removed after applying formatted files.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const paths = [
  'apps/web/src/catalog/BarcodeLabelsPage.tsx',
  'apps/web/src/layout/dashboard-period.test.ts',
  'apps/web/src/layout/dashboard-period.ts',
  'apps/web/src/layout/SellerLayout.tsx',
];
execFileSync('node', ['node_modules/prettier/bin/prettier.cjs', '--write', ...paths], { stdio: 'inherit' });
for (let i = 0; i < paths.length; i++) {
  const encoded = JSON.stringify(readFileSync(paths[i], 'utf8'));
  for (let j = 0; j < encoded.length; j += 2000) {
    console.log('PR104F:' + i + ':' + (j / 2000) + ':' + encoded.slice(j, j + 2000));
  }
}
