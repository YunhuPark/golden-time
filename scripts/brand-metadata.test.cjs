const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/site.webmanifest', 'utf8'));
const icon = fs.readFileSync('public/golden-time.svg', 'utf8');
const socialPreview = fs.readFileSync('public/golden-time-og.jpg');

test('index uses Golden Time favicon and manifest instead of Vite defaults', () => {
  assert.match(html, /href="\/golden-time\.svg"/);
  assert.match(html, /href="\/site\.webmanifest"/);
  assert.doesNotMatch(html, /vite\.svg/);
});

test('canonical and social metadata point to production', () => {
  assert.match(html, /rel="canonical" href="https:\/\/golden-time\.vercel\.app\/"/);
  assert.match(html, /property="og:url" content="https:\/\/golden-time\.vercel\.app\/"/);
  assert.match(html, /property="og:locale" content="ko_KR"/);
  assert.match(html, /property="og:image" content="https:\/\/golden-time\.vercel\.app\/golden-time-og\.jpg"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image" content="https:\/\/golden-time\.vercel\.app\/golden-time-og\.jpg"/);
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

test('social preview is a real JPEG asset', () => {
  assert.ok(socialPreview.length > 10000);
  assert.equal(socialPreview[0], 0xff);
  assert.equal(socialPreview[1], 0xd8);
  assert.equal(socialPreview.at(-2), 0xff);
  assert.equal(socialPreview.at(-1), 0xd9);
});
