import { describe, expect, it, vi } from 'vitest';
import {
  cleanCreatePayload,
  cleanPayload,
  importTasksApi,
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
