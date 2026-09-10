const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/site.webmanifest', 'utf8'));
const icon = fs.readFileSync('public/golden-time.svg', 'utf8');

test('index uses Golden Time favicon and manifest instead of Vite defaults', () => {
  assert.match(html, /href="\/golden-time\.svg"/);
  assert.match(html, /href="\/site\.webmanifest"/);
  assert.doesNotMatch(html, /vite\.svg/);
});

test('canonical and social metadata point to production', () => {
  assert.match(html, /rel="canonical" href="https:\/\/golden-time\.vercel\.app\/"/);
  assert.match(html, /property="og:url" content="https:\/\/golden-time\.vercel\.app\/"/);
  assert.match(html, /property="og:locale" content="ko_KR"/);
  assert.match(html, /name="twitter:card" content="summary"/);
});

test('web manifest is aligned with Golden Time branding', () => {
  assert.equal(manifest.short_name, 'Golden Time');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.theme_color, '#FF3B30');
  assert.ok(manifest.icons.some((entry) => entry.src === '/golden-time.svg'));
});

test('favicon is a self-contained SVG without external resources', () => {
  assert.match(icon, /^<svg[\s\S]*<\/svg>\s*$/);
  assert.doesNotMatch(icon, /(?:href|src)="https?:\/\//i);
  assert.doesNotMatch(icon, /<script/i);
});
