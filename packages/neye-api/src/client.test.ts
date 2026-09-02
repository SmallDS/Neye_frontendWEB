import { describe, expect, it, vi } from 'vitest';

import { loginApi } from './client';

vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api/v1' }),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: null,
    setAccessToken: vi.fn(),
    setLoginExpired: vi.fn(),
  }),
}));

describe('portal login', () => {
  it('sends the selected portal without a tenant header', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ accessToken: 'token', user: {} }, { status: 200 }),
      );

    await loginApi({ password: 'secret', username: 'admin' }, 'admin');

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('X-Portal-Type')).toBe('admin');
    expect(headers.has('X-Tenant-Id')).toBe(false);
    fetchMock.mockRestore();
  });
});
