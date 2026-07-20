import type {
  AdminOverview,
  AdminSystemStatus,
  EventLogClearPayload,
  EventLogClearPreview,
  EventLogClearResult,
  EventLogClearSelection,
  EventLogQuery,
  EventLogRetention,
  EventLogRetentionResult,
  EventLog,
  ImportCapabilities,
  ImportTask,
  PageResult,
  PickupNotificationAttempt,
  PickupNotificationQr,
  WechatPickupNotificationSettings,
  UserBatchStatusResult,
  UserStatus,
} from '#/types/neye';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const API_BASE_URL = apiURL || '/api';

export interface NeyeApiErrorData {
  code?: string;
  details?: unknown;
  message: string;
  requestId?: string;
}

export class NeyeApiError extends Error {
  override readonly name = 'NeyeApiError';

  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export function getApiErrorMessage(
  error: unknown,
  fallback = '操作失败，请稍后重试',
) {
  if (error instanceof NeyeApiError && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function getLoginErrorMessage(error: unknown) {
  if (error instanceof NeyeApiError && error.status === 401) {
    return '账号或密码错误，请重新输入';
  }
  return getApiErrorMessage(error, '登录失败，请稍后重试');
}

interface NeyeApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

function clearUnauthorizedSession() {
  const accessStore = useAccessStore();
  accessStore.setAccessToken(null);
  accessStore.setLoginExpired(true);
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('neye.selectedTenantId');
    window.dispatchEvent(new CustomEvent('neye:unauthorized'));
  }
}

async function neyeFetch(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!options.skipAuth) {
    const accessStore = useAccessStore();
    if (accessStore.accessToken) {
      headers.set('Authorization', `Bearer ${accessStore.accessToken}`);
      const tenantId =
        typeof window === 'undefined'
          ? ''
          : window.localStorage.getItem('neye.selectedTenantId');
      if (tenantId) headers.set('X-Tenant-Id', tenantId);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    if (response.status === 401 && !options.skipAuth)
      clearUnauthorizedSession();
    return response;
  } catch (error) {
    throw new NeyeApiError(
      0,
      null,
      '无法连接服务器，请检查网络后重试',
      'NETWORK_ERROR',
      error,
    );
  }
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? safeJson(text) : null;
}

export async function neyeApiRequest<T>(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<T> {
  const response = await neyeFetch(path, options);
  const body = await parseResponse(response);
  if (!response.ok) throw createApiError(response.status, body);
  return body as T;
}

export async function neyeApiBlob(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<Blob> {
  const response = await neyeFetch(path, options);
  if (!response.ok)
    throw createApiError(response.status, await parseResponse(response));
  return response.blob();
}

export const apiRequest = neyeApiRequest;
export const apiBlob = neyeApiBlob;

/**
 * Removes only `undefined`. Empty strings and null are intentional values in
 * PATCH requests and must survive serialization so optional fields can be cleared.
 */
export function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

/** Use for create requests where blank optional inputs should be omitted. */
export function cleanCreatePayload<T extends Record<string, unknown>>(
  payload: T,
) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

export function toQueryString(query: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const importTasksApi = {
  getCapabilities() {
    return apiRequest<ImportCapabilities>('/import-tasks/capabilities');
  },
  getErrorReport(taskId: string) {
    return apiBlob(`/import-tasks/${taskId}/error-report`);
  },
  createCustomerOptometry(payload: FormData) {
    return apiRequest<ImportTask>('/import-tasks/customer-optometry', {
      body: payload,
      method: 'POST',
    });
  },
};
export const pickupNotificationsApi = {
  getQr(fittingOrderId: string) {
    return apiRequest<PickupNotificationQr>(
      `/fitting-orders/${fittingOrderId}/pickup-subscription-qr`,
    );
  },
  markReady(fittingOrderId: string) {
    return apiRequest(`/fitting-orders/${fittingOrderId}/ready-for-pickup`, {
      method: 'PATCH',
    });
  },
  retry(fittingOrderId: string, reason: string) {
    return apiRequest(
      `/fitting-orders/${fittingOrderId}/pickup-notification/retry`,
      {
        body: JSON.stringify({ reason }),
        method: 'POST',
      },
    );
  },
  getAttempts(fittingOrderId: string) {
    return apiRequest<{ items: PickupNotificationAttempt[] }>(
      `/fitting-orders/${fittingOrderId}/pickup-notification/attempts`,
    );
  },
};
export const adminApi = {
  getWechatPickupNotification() {
    return apiRequest<WechatPickupNotificationSettings>(
      '/system-settings/wechat-pickup-notification',
    );
  },
  updateWechatPickupNotification(
    payload: Omit<
      WechatPickupNotificationSettings,
      'valid' | 'validationErrors'
    >,
  ) {
    return apiRequest<WechatPickupNotificationSettings>(
      '/system-settings/wechat-pickup-notification',
      { body: JSON.stringify(payload), method: 'PATCH' },
    );
  },
  getOverview() {
    return apiRequest<AdminOverview>('/admin/overview');
  },
  getSystemStatus() {
    return apiRequest<AdminSystemStatus>('/admin/system-status');
  },
  getEventLogs(query: EventLogQuery) {
    const params = toQueryString({ ...query });
    return apiRequest<PageResult<EventLog>>(`/admin/event-logs?${params}`);
  },
  getEventLog(id: string) {
    return apiRequest<EventLog>(`/admin/event-logs/${id}`);
  },
  getEventLogRetention() {
    return apiRequest<EventLogRetention>('/admin/event-logs/retention');
  },
  updateEventLogRetention(payload: EventLogRetention) {
    return apiRequest<EventLogRetentionResult>('/admin/event-logs/retention', {
      body: JSON.stringify(payload),
      method: 'PATCH',
    });
  },
  previewEventLogClear(payload: EventLogClearSelection) {
    return apiRequest<EventLogClearPreview>('/admin/event-logs/clear-preview', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  },
  clearEventLogs(payload: EventLogClearPayload) {
    return apiRequest<EventLogClearResult>('/admin/event-logs/clear', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  },
  updateUsersStatus(payload: { status: UserStatus; userIds: string[] }) {
    return apiRequest<UserBatchStatusResult>('/users/batch-status', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  },
};

export function normalizeApiErrorBody(
  body: unknown,
  status: number,
): NeyeApiErrorData {
  if (typeof body !== 'object' || !body) {
    return {
      message:
        status < 500 && typeof body === 'string' && body.trim()
          ? body
          : defaultApiErrorMessage(status),
    };
  }

  const value = body as Record<string, unknown>;
  const nested =
    typeof value.error === 'object' && value.error
      ? (value.error as Record<string, unknown>)
      : undefined;
  const rawMessage = value.message ?? nested?.message ?? value.error;
  let message = defaultApiErrorMessage(status);
  if (status < 500) {
    if (Array.isArray(rawMessage)) message = rawMessage.map(String).join('；');
    else if (typeof rawMessage === 'string' && rawMessage.trim()) {
      message = rawMessage;
    }
  }

  return {
    code: stringValue(value.code ?? nested?.code),
    details: value.details ?? nested?.details,
    message,
    requestId: stringValue(
      value.requestId ?? value.request_id ?? nested?.requestId,
    ),
  };
}

function defaultApiErrorMessage(status: number) {
  switch (status) {
    case 400: {
      return '请求参数有误，请检查后重试';
    }
    case 401: {
      return '登录状态已失效，请重新登录';
    }
    case 403: {
      return '当前账号没有执行此操作的权限';
    }
    case 404: {
      return '请求的服务不存在或已下线';
    }
    case 408: {
      return '请求超时，请检查网络后重试';
    }
    case 429: {
      return '操作过于频繁，请稍后再试';
    }
    default: {
      return status >= 500
        ? '服务器暂时不可用，请稍后重试'
        : `请求失败（${status}）`;
    }
  }
}

function createApiError(status: number, body: unknown) {
  const normalized = normalizeApiErrorBody(body, status);
  return new NeyeApiError(
    status,
    body,
    normalized.message,
    normalized.code,
    normalized.details,
    normalized.requestId,
  );
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}
