import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SUPABASE_URL,
  getSupabaseProjectRefFromJwt,
  getSupabaseProjectRefFromUrl,
  resolveSupabasePublicConfig,
} from './supabaseConfig';

describe('Supabase public config', () => {
  it('extracts the project ref from a valid Supabase URL', () => {
    expect(getSupabaseProjectRefFromUrl('https://exampleproject.supabase.co')).toBe('exampleproject');
  });

  it('uses the canonical project when the obsolete production project ref is configured', () => {
    const result = resolveSupabasePublicConfig(
      'https://ojmqbhrixmgezavipvxa.supabase.co',
      'legacy-key'
    );

    expect(result.url).toBe(CANONICAL_SUPABASE_URL);
    expect(result.source).toBe('canonical-fallback');
    expect(result.reason).toBe('legacy-project');
  });

  it('uses the environment configuration when the URL and key are usable', () => {
    const result = resolveSupabasePublicConfig(
      'https://anotherproject.supabase.co',
      'sb_publishable_example'
    );

    expect(result).toEqual({
      url: 'https://anotherproject.supabase.co',
      anonKey: 'sb_publishable_example',
      source: 'environment',
    });
  });

  it('decodes the project ref from the canonical legacy anon JWT', async () => {
    const { CANONICAL_SUPABASE_ANON_KEY } = await import('./supabaseConfig');
    expect(getSupabaseProjectRefFromJwt(CANONICAL_SUPABASE_ANON_KEY)).toBe('aiggzhblnuxkgzzmsgrl');
  });
});
