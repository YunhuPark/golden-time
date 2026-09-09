/**
 * Golden Time Supabase public client configuration.
 *
 * Supabase-backed account features are optional. They are enabled only when
 * the deployment explicitly opts in and provides a usable URL/key pair.
 * Invalid, missing, or known-dead projects fail closed instead of falling back
 * to another remote project.
 */

export const DISABLED_SUPABASE_URL = 'https://disabled.invalid';
export const DISABLED_SUPABASE_ANON_KEY = 'supabase-disabled';

const KNOWN_UNAVAILABLE_SUPABASE_PROJECT_REFS = new Set([
  'ojmqbhrixmgezavipvxa',
  'aiggzhblnuxkgzzmsgrl',
]);

export type SupabaseConfigSource = 'environment' | 'disabled';
export type SupabaseDisabledReason =
  | 'not-enabled'
  | 'missing'
  | 'invalid-url'
  | 'unavailable-project'
  | 'project-mismatch';

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
  source: SupabaseConfigSource;
  reason?: SupabaseDisabledReason;
}

export function getSupabaseProjectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getSupabaseProjectRefFromJwt(key: string): string | null {
  if (!key || !key.includes('.')) return null;

  const parts = key.split('.');
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(globalThis.atob(padded)) as { ref?: unknown };
    return typeof payload.ref === 'string' ? payload.ref : null;
  } catch {
    return null;
  }
}

const disabledConfig = (reason: SupabaseDisabledReason): SupabasePublicConfig => ({
  url: DISABLED_SUPABASE_URL,
  anonKey: DISABLED_SUPABASE_ANON_KEY,
  source: 'disabled',
  reason,
});

export function resolveSupabasePublicConfig(
  configuredUrl?: string,
  configuredAnonKey?: string,
  explicitlyEnabled = false
): SupabasePublicConfig {
  if (!explicitlyEnabled) {
    return disabledConfig('not-enabled');
  }

  if (!configuredUrl || !configuredAnonKey) {
    return disabledConfig('missing');
  }

  const urlRef = getSupabaseProjectRefFromUrl(configuredUrl);
  if (!urlRef) {
    return disabledConfig('invalid-url');
  }

  if (KNOWN_UNAVAILABLE_SUPABASE_PROJECT_REFS.has(urlRef)) {
    return disabledConfig('unavailable-project');
  }

  const keyRef = getSupabaseProjectRefFromJwt(configuredAnonKey);
  if (keyRef && keyRef !== urlRef) {
    return disabledConfig('project-mismatch');
  }

  return {
    url: configuredUrl,
    anonKey: configuredAnonKey,
    source: 'environment',
  };
}
