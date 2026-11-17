import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../../infrastructure/supabase/supabaseClient', () => ({ supabase: { rpc, from } }));
import { EmergencyShareService } from './EmergencyShareService';

describe('anonymous emergency sharing', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('reads and counts a share through the token-bound RPC only', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'share', medical_data: { allergies: 'synthetic' },
      expires_at: '2099-01-01', view_count: 1, created_at: '2026-01-01' }], error: null });
    const result = await EmergencyShareService.getShareByToken('6d1223a6-3524-44ae-b83d-09b2ef1be620');
    expect(result.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith('read_emergency_share', {
      p_token: '6d1223a6-3524-44ae-b83d-09b2ef1be620',
    });
    expect(from).not.toHaveBeenCalled();
  });
  it('does not query malformed tokens and hides missing/expired shares', async () => {
    expect((await EmergencyShareService.getShareByToken('invalid')).success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await EmergencyShareService.getShareByToken('6d1223a6-3524-44ae-b83d-09b2ef1be620')).success).toBe(false);
  });
});
