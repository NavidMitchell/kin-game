// Folds the standalone build's script bundle into its HTML page -> dist/kin-runner.html
import { readFileSync, writeFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = 'dist/.standalone';
let html = readFileSync(join(src, 'index.html'), 'utf8');
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, file) => {
  const js = readFileSync(join(src, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, file) =>
  `<style>${readFileSync(join(src, file), 'utf8')}</style>`);
if (/src="\.\/assets\//.test(html)) throw new Error('an asset was not inlined');
const dest = 'dist/kin-runner.html';
writeFileSync(dest, html);
rmSync(src, { recursive: true, force: true });
console.log('wrote', dest, (statSync(dest).size / 1e6).toFixed(1) + ' MB');
