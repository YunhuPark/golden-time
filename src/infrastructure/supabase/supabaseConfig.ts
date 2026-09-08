/**
 * Golden Time Supabase public client configuration.
 *
 * Supabase anon/publishable keys are public browser credentials; access control
 * is enforced by Row Level Security (RLS). Environment variables remain the
 * preferred source, but we recover from the obsolete Production project ref
 * that currently fails DNS resolution.
 */

export const CANONICAL_SUPABASE_URL = 'https://aiggzhblnuxkgzzmsgrl.supabase.co';

export const CANONICAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZ2d6aGJsbnV4a2d6em1zZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjM4MzMsImV4cCI6MjA4MjYzOTgzM30.f2-BrgPCKhZ_lHLfvOBY2Q4f55xFsGGYGGjAgxttcHc';

const LEGACY_SUPABASE_PROJECT_REFS = new Set(['ojmqbhrixmgezavipvxa']);

export type SupabaseConfigSource = 'environment' | 'canonical-fallback';

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
  source: SupabaseConfigSource;
  reason?: 'missing' | 'invalid-url' | 'legacy-project' | 'project-mismatch';
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

export function resolveSupabasePublicConfig(
  configuredUrl?: string,
  configuredAnonKey?: string
): SupabasePublicConfig {
  if (!configuredUrl || !configuredAnonKey) {
    return {
      url: CANONICAL_SUPABASE_URL,
      anonKey: CANONICAL_SUPABASE_ANON_KEY,
      source: 'canonical-fallback',
      reason: 'missing',
    };
  }

  const urlRef = getSupabaseProjectRefFromUrl(configuredUrl);
  if (!urlRef) {
    return {
      url: CANONICAL_SUPABASE_URL,
      anonKey: CANONICAL_SUPABASE_ANON_KEY,
      source: 'canonical-fallback',
      reason: 'invalid-url',
    };
  }

  if (LEGACY_SUPABASE_PROJECT_REFS.has(urlRef)) {
    return {
      url: CANONICAL_SUPABASE_URL,
      anonKey: CANONICAL_SUPABASE_ANON_KEY,
      source: 'canonical-fallback',
      reason: 'legacy-project',
    };
  }

  const keyRef = getSupabaseProjectRefFromJwt(configuredAnonKey);
  if (keyRef && keyRef !== urlRef) {
    return {
      url: CANONICAL_SUPABASE_URL,
      anonKey: CANONICAL_SUPABASE_ANON_KEY,
      source: 'canonical-fallback',
      reason: 'project-mismatch',
    };
  }

  return {
    url: configuredUrl,
    anonKey: configuredAnonKey,
    source: 'environment',
  };
}
