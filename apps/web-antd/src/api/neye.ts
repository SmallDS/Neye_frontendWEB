import { useAppConfig } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const API_BASE_URL =
  apiURL || import.meta.env.VITE_NEYE_API_BASE_URL || '/api';

export class NeyeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
  }
}

interface NeyeApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function neyeFetch(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!options.skipAuth) {
    const accessStore = useAccessStore();
    if (accessStore.accessToken) {
      headers.set('Authorization', `Bearer ${accessStore.accessToken}`);
    }
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

export async function neyeApiRequest<T>(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<T> {
  const response = await neyeFetch(path, options);
  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new NeyeApiError(response.status, body, getErrorMessage(body, response.status));
  }
  return body as T;
}

export async function neyeApiBlob(
  path: string,
  options: NeyeApiRequestOptions = {},
): Promise<Blob> {
  const response = await neyeFetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    const body = text ? safeJson(text) : null;
    throw new NeyeApiError(response.status, body, getErrorMessage(body, response.status));
  }
  return response.blob();
}

export const apiRequest = neyeApiRequest;
export const apiBlob = neyeApiBlob;

export function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(body: unknown, status: number) {
  if (typeof body === 'object' && body && 'message' in body) {
    const message = (body as { message: string | string[] }).message;
    return Array.isArray(message) ? message.join('; ') : message;
  }
  return `Request failed: ${status}`;
}