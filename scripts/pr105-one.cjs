const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = 'apps/web/src/staff/StaffPage.test.tsx';
execFileSync(process.execPath, ['node_modules/prettier/bin/prettier.cjs', '--write', path], { stdio: 'inherit' });
const encoded = JSON.stringify(readFileSync(path, 'utf8'));
for (let j = 0; j < encoded.length; j += 2000) {
  console.log('PR105ONE:' + (j / 2000) + ':' + encoded.slice(j, j + 2000));
}
