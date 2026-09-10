const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const entry = fs.readFileSync('src/main.tsx', 'utf8');

test('storage migration never clears the whole origin', () => {
  assert.doesNotMatch(entry, /localStorage\.clear\s*\(/);
});

test('storage migration only resets Golden-Time-owned keys', () => {
  assert.match(entry, /const APP_STORAGE_KEY = 'golden-time-storage'/);
  assert.match(entry, /localStorage\.removeItem\(APP_STORAGE_KEY\)/);
  assert.match(entry, /localStorage\.removeItem\(VERSION_KEY\)/);
  assert.match(entry, /localStorage\.setItem\(APP_STORAGE_KEY,/);
  assert.match(entry, /localStorage\.setItem\(VERSION_KEY, STORAGE_VERSION\)/);
});
