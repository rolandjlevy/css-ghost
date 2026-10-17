import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

const readme = readFileSync(resolve(root, 'README.md'), 'utf8')
  .replace(
    /https:\/\/img\.shields\.io\/npm\/v\/%40rolandjlevy%2Fcss-ghost/g,
    'https://img.shields.io/npm/v/css-ghost',
  )
  .replace(
    /https:\/\/img\.shields\.io\/npm\/dm\/%40rolandjlevy%2Fcss-ghost/g,
    'https://img.shields.io/npm/dm/css-ghost',
  )
  .replace(
    /https:\/\/img\.shields\.io\/node\/v\/%40rolandjlevy%2Fcss-ghost/g,
    'https://img.shields.io/node/v/css-ghost',
  )
  .replace(/\/package\/@rolandjlevy\/css-ghost/g, '/package/css-ghost');

writeFileSync(resolve(__dirname, '../README.md'), readme);
console.log('README synced from root');
