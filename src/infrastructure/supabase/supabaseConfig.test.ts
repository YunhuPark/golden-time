import { describe, expect, it } from 'vitest';
import {
  DISABLED_SUPABASE_URL,
  getSupabaseProjectRefFromJwt,
  getSupabaseProjectRefFromUrl,
  resolveSupabasePublicConfig,
} from './supabaseConfig';

describe('Supabase public config', () => {
  it('extracts the project ref from a valid Supabase URL', () => {
    expect(getSupabaseProjectRefFromUrl('https://exampleproject.supabase.co')).toBe('exampleproject');
  });

  it('fails closed unless Supabase is explicitly enabled', () => {
    const result = resolveSupabasePublicConfig(
      'https://exampleproject.supabase.co',
      'sb_publishable_example'
    );

    expect(result).toEqual({
      url: DISABLED_SUPABASE_URL,
      anonKey: 'supabase-disabled',
      source: 'disabled',
      reason: 'not-enabled',
    });
  });

  it('fails closed for known unavailable projects even when enabled', () => {
    const result = resolveSupabasePublicConfig(
      'https://aiggzhblnuxkgzzmsgrl.supabase.co',
      'legacy-key',
      true
    );

    expect(result.url).toBe(DISABLED_SUPABASE_URL);
    expect(result.source).toBe('disabled');
    expect(result.reason).toBe('unavailable-project');
  });

  it('uses environment configuration only when explicitly enabled and usable', () => {
    const result = resolveSupabasePublicConfig(
      'https://anotherproject.supabase.co',
      'sb_publishable_example',
      true
    );

    expect(result).toEqual({
      url: 'https://anotherproject.supabase.co',
      anonKey: 'sb_publishable_example',
      source: 'environment',
    });
  });

  it('rejects a JWT whose project ref does not match the URL', () => {
    const payload = btoa(JSON.stringify({ ref: 'differentproject' }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const jwt = `header.${payload}.signature`;

    expect(getSupabaseProjectRefFromJwt(jwt)).toBe('differentproject');
    expect(
      resolveSupabasePublicConfig(
        'https://anotherproject.supabase.co',
        jwt,
        true
      ).reason
    ).toBe('project-mismatch');
  });
});
