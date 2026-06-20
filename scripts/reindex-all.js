// Delegates to the TypeScript reindex script (chunk v5 pipeline).
const { execSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, 'reindex-all.ts');
execSync(`npx tsx "${script}"`, {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: process.env,
});
