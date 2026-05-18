import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteJson, fetchJson } from '../client';

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses backend error messages for JSON requests when provided', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: '직접 내려온 오류입니다.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(fetchJson('/api/example')).rejects.toThrow('직접 내려온 오류입니다.');
  });

  it('uses the same fallback error messages for delete requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    await expect(deleteJson('/api/example')).rejects.toThrow('서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  });
});
