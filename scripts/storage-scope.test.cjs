const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const entry = fs.readFileSync('src/main.tsx', 'utf8');

test('storage migration never clears the whole origin', () => {
  assert.doesNotMatch(entry, /(?:window\.)?localStorage\.clear\s*\(/);
});

test('storage migration only resets Golden-Time-owned keys', () => {
  assert.match(entry, /const APP_STORAGE_KEY = 'golden-time-storage'/);
  assert.match(entry, /window\.localStorage\.removeItem\(APP_STORAGE_KEY\)/);
  assert.match(entry, /window\.localStorage\.removeItem\(VERSION_KEY\)/);
  assert.match(entry, /window\.localStorage\.setItem\(APP_STORAGE_KEY,/);
  assert.match(entry, /window\.localStorage\.setItem\(VERSION_KEY, STORAGE_VERSION\)/);
});

test('storage migration is fail-open when browser storage is unavailable', () => {
  assert.match(entry, /try\s*\{/);
  assert.match(entry, /catch\s*\{/);
  assert.match(entry, /continuing without storage migration/);
});
