const STORAGE_VERSION = '2.1';
const VERSION_KEY = 'golden-time-version';
const APP_STORAGE_KEY = 'golden-time-storage';

/**
 * Migrate only Golden-Time-owned localStorage keys before the application
 * module graph hydrates Zustand persisted state.
 *
 * Storage access is fail-open because privacy-restricted browser contexts can
 * throw even while reading window.localStorage.
 */
export function migrateGoldenTimeStorage(): void {
  try {
    const storage = window.localStorage;

    if (storage.getItem(VERSION_KEY) !== STORAGE_VERSION) {
      console.log('🔄 Migrating Golden-Time storage data...');

      storage.removeItem(APP_STORAGE_KEY);
      storage.removeItem(VERSION_KEY);

      storage.setItem(APP_STORAGE_KEY, JSON.stringify({
        state: { themeMode: 'dark' },
        version: 0,
      }));
      storage.setItem(VERSION_KEY, STORAGE_VERSION);

      console.log('✅ Golden-Time storage migrated to Dark Mode default');
    }
  } catch {
    console.warn('⚠️ Browser storage is unavailable; continuing without storage migration.');
  }
}

migrateGoldenTimeStorage();
