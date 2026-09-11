const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const entry = fs.readFileSync('src/main.tsx', 'utf8');
const migration = fs.readFileSync('src/bootstrap/storageMigration.ts', 'utf8');
const store = fs.readFileSync('src/infrastructure/state/store.ts', 'utf8');

test('storage migration runs before App import can hydrate persisted state', () => {
  const migrationImport = entry.indexOf("import './bootstrap/storageMigration';");
  const appImport = entry.indexOf("import App from './App';");

  assert.notEqual(migrationImport, -1);
  assert.notEqual(appImport, -1);
  assert.ok(migrationImport < appImport);
});

test('storage migration never clears the whole origin', () => {
  assert.doesNotMatch(migration, /(?:window\.)?localStorage\.clear\s*\(/);
});

test('storage migration only resets Golden-Time-owned keys', () => {
  assert.match(migration, /const APP_STORAGE_KEY = 'golden-time-storage'/);
  assert.match(migration, /storage\.removeItem\(APP_STORAGE_KEY\)/);
  assert.match(migration, /storage\.removeItem\(VERSION_KEY\)/);
  assert.match(migration, /storage\.setItem\(APP_STORAGE_KEY,/);
  assert.match(migration, /storage\.setItem\(VERSION_KEY, STORAGE_VERSION\)/);
});

test('storage migration is fail-open when browser storage is unavailable', () => {
  assert.match(migration, /try\s*\{/);
  assert.match(migration, /catch\s*\{/);
  assert.match(migration, /continuing without storage migration/);
});

test('zustand persistence is also fail-open when localStorage throws', () => {
  assert.match(store, /const safeLocalStorage: StateStorage/);
  assert.match(store, /getItem:[\s\S]*try\s*\{[\s\S]*window\.localStorage\.getItem/);
  assert.match(store, /setItem:[\s\S]*try\s*\{[\s\S]*window\.localStorage\.setItem/);
  assert.match(store, /removeItem:[\s\S]*try\s*\{[\s\S]*window\.localStorage\.removeItem/);
  assert.match(store, /storage: createJSONStorage\(\(\) => safeLocalStorage\)/);
});
