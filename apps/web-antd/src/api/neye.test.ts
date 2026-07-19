import { describe, expect, it, vi } from 'vitest';

import {
  cleanCreatePayload,
  cleanPayload,
  getApiErrorMessage,
  getLoginErrorMessage,
  importTasksApi,
  NeyeApiError,
  normalizeApiErrorBody,
  toQueryString,
} from './neye';

vi.mock('@vben/hooks', () => ({
  useAppConfig: () => ({ apiURL: '/api' }),
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({
    accessToken: null,
    setAccessToken: vi.fn(),
    setLoginExpired: vi.fn(),
  }),
}));

describe('neye API utilities', () => {
  it('keeps explicit empty values for PATCH clearing', () => {
    expect(
      cleanPayload({ phone: '', remark: null, untouched: undefined }),
    ).toEqual({ phone: '', remark: null });
  });

  it('omits blank optional values for create requests', () => {
    expect(
      cleanCreatePayload({ name: '张三', phone: '', remark: null }),
    ).toEqual({ name: '张三' });
  });

  it('normalizes flat and nested API errors', () => {
    expect(
      normalizeApiErrorBody(
        {
          code: 'INVALID',
          message: ['字段错误', '请重试'],
          requestId: 'req-1',
        },
        400,
      ),
    ).toMatchObject({
      code: 'INVALID',
      message: '字段错误；请重试',
      requestId: 'req-1',
    });
    expect(
      normalizeApiErrorBody(
        { error: { code: 'DENIED', message: '无权限' } },
        403,
      ),
    ).toMatchObject({ code: 'DENIED', message: '无权限' });
  });

  it('provides user-facing messages for status-only API errors', () => {
    expect(normalizeApiErrorBody(null, 401).message).toBe(
      '登录状态已失效，请重新登录',
    );
    expect(normalizeApiErrorBody({}, 500).message).toBe(
      '服务器暂时不可用，请稍后重试',
    );
  });

  it('maps real login failures to a stable Chinese message', () => {
    const error = new NeyeApiError(
      401,
      { message: 'Invalid username or password' },
      'Invalid username or password',
    );
    expect(getLoginErrorMessage(error)).toBe('账号或密码错误，请重新输入');
  });

  it('does not expose gateway HTML for server errors', () => {
    expect(normalizeApiErrorBody('<html>Bad Gateway</html>', 502).message).toBe(
      '服务器暂时不可用，请稍后重试',
    );
    expect(
      normalizeApiErrorBody({ message: 'internal stack detail' }, 503).message,
    ).toBe('服务器暂时不可用，请稍后重试');
  });

  it('uses API errors for display and hides unknown internal errors', () => {
    expect(
      getApiErrorMessage(
        new NeyeApiError(0, null, '无法连接服务器，请检查网络后重试'),
        '登录失败',
      ),
    ).toBe('无法连接服务器，请检查网络后重试');
    expect(getApiErrorMessage(new Error('internal detail'), '登录失败')).toBe(
      '登录失败',
    );
  });

  it('omits empty query values', () => {
    expect(toQueryString({ keyword: '', page: 2, status: undefined })).toBe(
      'page=2',
    );
  });
  it('requests import capabilities and creates an upload without JSON headers', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          batchSize: 750,
          maxColumns: 80,
          maxFileBytes: 52_428_800,
          maxRows: 50_000,
          maxSheets: 10,
          workerConcurrency: 1,
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            id: 'task-1',
            phase: 'uploaded',
            status: 'pending',
          },
          { status: 201 },
        ),
      );

    await expect(importTasksApi.getCapabilities()).resolves.toMatchObject({
      maxRows: 50_000,
      batchSize: 750,
    });
    const form = new FormData();
    form.append('tenantId', 'tenant-1');
    await expect(
      importTasksApi.createCustomerOptometry(form),
    ).resolves.toMatchObject({ id: 'task-1' });
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).has('Content-Type'),
    ).toBe(false);
    fetchMock.mockRestore();
  });
});
