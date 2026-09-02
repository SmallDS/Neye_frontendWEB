import type { LoginResult } from '#/types/neye';

import { neyeApiRequest } from '#/api/neye';

export type WechatSessionStatus =
  | 'authenticated'
  | 'binding_required'
  | 'confirmed'
  | 'consumed'
  | 'expired'
  | 'pending';

export interface WechatAuthConfig {
  enabled: boolean;
  appId: string;
  secretConfigured: boolean;
}

export interface WechatSession {
  id: string;
  status: WechatSessionStatus;
  expiresAt: string;
  qrCodeDataUrl: string;
}

export interface WechatSessionResult extends Partial<LoginResult> {
  status: WechatSessionStatus;
}

export function getWechatAuthConfigApi() {
  return neyeApiRequest<WechatAuthConfig>('/auth/wechat/config', {
    skipAuth: true,
  });
}

export function createWechatLoginSessionApi() {
  return neyeApiRequest<WechatSession>('/auth/wechat/web-sessions', {
    method: 'POST',
    skipAuth: true,
  });
}

export function createWechatBindingSessionApi() {
  return neyeApiRequest<WechatSession>('/auth/wechat/bind-sessions', {
    method: 'POST',
  });
}

export function pollWechatSessionApi(id: string) {
  return neyeApiRequest<WechatSessionResult>(
    `/auth/wechat/web-sessions/${id}`,
    { skipAuth: true },
  );
}

export function unbindWechatApi() {
  return neyeApiRequest<{ bound: boolean; deleted: boolean }>(
    '/auth/wechat/binding',
    { method: 'DELETE' },
  );
}
