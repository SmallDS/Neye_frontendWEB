import type {
  AdminOverview,
  AdminSystemStatus,
  CommercePermission,
  CommerceSettings,
  DailyCommerceReport,
  EventLog,
  EventLogClearPayload,
  EventLogClearPreview,
  EventLogClearResult,
  EventLogClearSelection,
  EventLogQuery,
  EventLogRetention,
  EventLogRetentionResult,
  FittingCheckoutQueueResult,
  FittingCheckoutQueueState,
  ImportCapabilities,
  ImportTask,
  InventoryBalance,
  LoginResult,
  PageResult,
  PaymentAccount,
  PaymentIntent,
  PaymentTransaction,
  PickupNotificationAttempt,
  PickupNotificationQr,
  SalesLine,
  SalesOrder,
  TenantPermissionGroup,
  TenantSku,
  UserBatchStatusResult,
  UserStatus,
  WechatPickupNotificationSettings,
} from './types';

import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const API_BASE_URL = normalizeApiBase(apiURL);

export type PortalType = 'admin' | 'merchant';

interface NeyeApiConfiguration {
  tenantStorageKey: string;
}

const apiConfiguration: NeyeApiConfiguration = {
  tenantStorageKey: 'neye.merchant.selectedTenantId',
};

export function configureNeyeApi(configuration: Partial<NeyeApiConfiguration>) {
  Object.assign(apiConfiguration, configuration);
}

function normalizeApiBase(value?: string) {
  const base = (value || '/api/v1').replace(/\/$/, '');
  if (base.endsWith('/api/v1')) return base;
  if (base.endsWith('/api')) return `${base}/v1`;
  return `${base}/api/v1`;
}

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

export interface NeyeApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  tenantId?: null | string;
}

function clearUnauthorizedSession() {
  const accessStore = useAccessStore();
  accessStore.setAccessToken(null);
  accessStore.setLoginExpired(true);
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(apiConfiguration.tenantStorageKey);
    window.dispatchEvent(new CustomEvent('neye:unauthorized'));
  }
}

async function neyeFetch(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<Response> {
  const {
    skipAuth = false,
    tenantId: tenantOverride,
    ...requestOptions
  } = options;
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!skipAuth) {
    const accessStore = useAccessStore();
    if (accessStore.accessToken) {
      headers.set('Authorization', `Bearer ${accessStore.accessToken}`);
      const tenantId =
        tenantOverride === null
          ? ''
          : (tenantOverride ??
            (typeof window === 'undefined'
              ? ''
              : window.localStorage.getItem(
                  apiConfiguration.tenantStorageKey,
                )));
      if (tenantId) headers.set('X-Tenant-Id', tenantId);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers,
    });
    if (response.status === 401 && !skipAuth) clearUnauthorizedSession();
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
  if (!response.ok) {
    const error = createApiError(response.status, body);
    if (error.status === 403 && error.code === 'TENANT_FORBIDDEN') {
      await refreshTenantMembership();
    }
    throw error;
  }
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

export async function loginApi(
  data: { password?: string; username?: string },
  portal: PortalType,
) {
  return neyeApiRequest<LoginResult>('/auth/login', {
    body: JSON.stringify(data),
    headers: { 'X-Portal-Type': portal },
    method: 'POST',
    skipAuth: true,
    tenantId: null,
  });
}

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
  getErrorReport(taskId: string, tenantId: string) {
    return apiBlob(`/import-tasks/${taskId}/error-report`, { tenantId });
  },
  createCustomerOptometry(
    payload: FormData,
    idempotencyKey: string,
    tenantId: string,
  ) {
    return apiRequest<ImportTask>('/import-tasks/customer-optometry', {
      body: payload,
      headers: { 'Idempotency-Key': idempotencyKey },
      method: 'POST',
      tenantId,
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

export function idempotencyHeaders(key?: string) {
  return {
    'Idempotency-Key':
      key ??
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
  };
}

export const commerceApi = {
  listFittingCheckoutQueue(
    params: {
      keyword?: string;
      page?: number;
      pageSize?: number;
      state?: FittingCheckoutQueueState;
    } = {},
  ) {
    const query = new URLSearchParams();
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.state) query.set('state', params.state);
    return apiRequest<FittingCheckoutQueueResult>(
      `/commerce/fitting-checkout-queue?${query.toString()}`,
      {},
    );
  },
  getSettings() {
    return apiRequest<CommerceSettings>('/commerce/settings');
  },
  updateSettings(payload: Partial<CommerceSettings>) {
    return apiRequest<CommerceSettings>('/commerce/settings', {
      body: JSON.stringify(payload),
      method: 'PATCH',
    });
  },
  getPaymentStatus() {
    return apiRequest<{
      paymentMode: 'direct' | 'platform';
      providers: Record<string, boolean>;
    }>('/commerce/payment-status');
  },
  listSkus() {
    return apiRequest<{ items: TenantSku[]; total: number }>('/commerce/skus');
  },
  createSku(payload: Record<string, unknown>) {
    return apiRequest<TenantSku>('/commerce/skus', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  },
  listInventory() {
    return apiRequest<{
      items: InventoryBalance[];
      total: number;
    }>('/commerce/inventory');
  },
  listInventoryDocuments() {
    return apiRequest<{ items: Array<Record<string, unknown>>; total: number }>(
      '/commerce/inventory/documents',
    );
  },
  listInventoryMovements() {
    return apiRequest<{ items: Array<Record<string, unknown>>; total: number }>(
      '/commerce/inventory/movements',
    );
  },
  createInventoryDocument(payload: Record<string, unknown>) {
    return apiRequest<Record<string, unknown>>(
      '/commerce/inventory/documents',
      {
        body: JSON.stringify(payload),
        headers: idempotencyHeaders(),
        method: 'POST',
      },
    );
  },
  receiveTransfer(id: string) {
    return apiRequest(`/commerce/inventory/transfers/${id}/receive`, {
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  listSales() {
    return apiRequest<{
      items: SalesOrder[];
      total: number;
    }>('/commerce/sales');
  },
  createSale(payload: {
    customerId?: string;
    lines: SalesLine[];
    remark?: string;
  }) {
    return apiRequest<SalesOrder>('/commerce/sales', {
      body: JSON.stringify(payload),
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  createFittingSale(id: string) {
    return apiRequest<SalesOrder>(`/commerce/fitting-orders/${id}/sale`, {
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  getSale(id: string) {
    return apiRequest<SalesOrder>(`/commerce/sales/${id}`);
  },
  updateSale(id: string, payload: Record<string, unknown>) {
    return apiRequest<SalesOrder>(`/commerce/sales/${id}`, {
      body: JSON.stringify(payload),
      headers: idempotencyHeaders(),
      method: 'PATCH',
    });
  },
  confirmSale(id: string, confirmNegative = false) {
    return apiRequest<SalesOrder>(`/commerce/sales/${id}/confirm`, {
      body: JSON.stringify({ confirmNegative }),
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  cancelSale(id: string) {
    return apiRequest<SalesOrder>(`/commerce/sales/${id}/cancel`, {
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  completeSale(id: string) {
    return apiRequest<SalesOrder>(`/commerce/sales/${id}/complete`, {
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  getReceipt(id: string) {
    return apiRequest<SalesOrder & { storeName: string; title: string }>(
      `/commerce/sales/${id}/receipt`,
    );
  },
  createPayment(id: string, payload: Record<string, unknown>) {
    return apiRequest<PaymentIntent>(`/commerce/sales/${id}/payments`, {
      body: JSON.stringify(payload),
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  listPayments() {
    return apiRequest<{ items: PaymentTransaction[]; total: number }>(
      '/commerce/payments',
    );
  },
  refundPayment(id: string, payload: Record<string, unknown>) {
    return apiRequest<PaymentTransaction>(`/commerce/payments/${id}/refunds`, {
      body: JSON.stringify(payload),
      headers: idempotencyHeaders(),
      method: 'POST',
    });
  },
  getDailyReport(date?: string) {
    return apiRequest<DailyCommerceReport>(
      `/commerce/reports/daily${date ? `?date=${encodeURIComponent(date)}` : ''}`,
    );
  },
};

export const adminCommerceApi = {
  getPermissions() {
    return apiRequest<{
      groups: TenantPermissionGroup[];
      permissions: CommercePermission[];
      templates: Record<string, CommercePermission[]>;
    }>('/admin/commerce/permissions');
  },
  getTenantSettings(tenantId: string) {
    return apiRequest<CommerceSettings>(`/admin/tenants/${tenantId}/commerce`);
  },
  updateTenantSettings(tenantId: string, payload: Partial<CommerceSettings>) {
    return apiRequest<CommerceSettings>(`/admin/tenants/${tenantId}/commerce`, {
      body: JSON.stringify(payload),
      method: 'PATCH',
    });
  },
  assignPermissions(
    tenantId: string,
    userId: string,
    permissions: CommercePermission[],
  ) {
    return apiRequest(
      `/admin/tenants/${tenantId}/users/${userId}/commerce-permissions`,
      { body: JSON.stringify({ permissions }), method: 'PUT' },
    );
  },
  listPaymentAccounts() {
    return apiRequest<{ items: PaymentAccount[]; total: number }>(
      '/admin/payment-accounts',
    );
  },
  createPaymentAccount(payload: Record<string, unknown>) {
    return apiRequest<PaymentAccount>('/admin/payment-accounts', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  },
  retirePaymentAccount(id: string) {
    return apiRequest(`/admin/payment-accounts/${id}/retire`, {
      method: 'POST',
    });
  },
  listSettlements() {
    return apiRequest<{ items: Array<Record<string, unknown>>; total: number }>(
      '/admin/settlements',
    );
  },
  listSettlementEligible(tenantId: string) {
    return apiRequest<{
      items: Array<Record<string, unknown>>;
      settlementAmount: string;
      total: number;
    }>(`/admin/settlements/eligible?tenantId=${encodeURIComponent(tenantId)}`);
  },
  createSettlement(payload: Record<string, unknown>) {
    return apiRequest('/admin/settlements', {
      body: JSON.stringify(payload),
      headers: idempotencyHeaders(),
      method: 'POST',
    });
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

async function refreshTenantMembership() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(apiConfiguration.tenantStorageKey);
  try {
    const response = await neyeFetch('/auth/me', { tenantId: null });
    const user = response.ok ? await parseResponse(response) : null;
    window.dispatchEvent(
      new CustomEvent('neye:tenant-invalid', { detail: user }),
    );
  } catch {
    window.dispatchEvent(new CustomEvent('neye:tenant-invalid'));
  }
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
