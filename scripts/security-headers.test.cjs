const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')
);

function globalHeaders() {
  const rule = config.headers?.find((entry) => entry.source === '/(.*)');
  assert.ok(rule, 'global Vercel header rule must exist');
  return new Map(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

test('security headers include CSP and MIME sniffing protection', () => {
  const headers = globalHeaders();
  assert.ok(headers.get('content-security-policy'));
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
});

test('referrer policy limits cross-origin referrer detail', () => {
  const headers = globalHeaders();
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('permissions policy blocks camera and microphone while keeping same-origin geolocation', () => {
  const headers = globalHeaders();
  assert.equal(
    headers.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=(self)'
  );
});
