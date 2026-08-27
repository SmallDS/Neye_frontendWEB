import type { UserInfo } from '@vben/types';

import type { CurrentUser } from '#/types/neye';

import { preferences } from '@vben/preferences';

import { neyeApiRequest } from '#/api/neye';

export interface ChangeCurrentPasswordParams {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateCurrentUserParams {
  displayName: string;
}

export async function getCurrentUserApi(): Promise<CurrentUser> {
  return neyeApiRequest<CurrentUser>('/auth/me');
}

export async function getUserInfoApi(): Promise<UserInfo> {
  const user = await getCurrentUserApi();
  const activeTenants = user.tenants.filter(
    (tenant) => tenant.status === 'active',
  );
  const storedTenantId =
    typeof window === 'undefined'
      ? ''
      : (window.localStorage.getItem('neye.selectedTenantId') ?? '');
  const tenant =
    activeTenants.find((item) => item.id === storedTenantId) ??
    activeTenants[0];
  const tenantId = tenant?.id ?? '';
  if (typeof window !== 'undefined') {
    if (tenantId)
      window.localStorage.setItem('neye.selectedTenantId', tenantId);
    else window.localStorage.removeItem('neye.selectedTenantId');
  }
  return {
    avatar: preferences.app.defaultAvatar,
    desc: tenant?.name ?? '系统管理员',
    homePath:
      user.role === 'admin'
        ? '/neye/system/tenants'
        : tenantId
          ? '/neye/customers'
          : '/profile',
    realName: user.displayName,
    roles: [user.role],
    token: '',
    userId: user.id,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
    tenant,
    tenantId,
    tenantIds: user.tenantIds,
    tenants: user.tenants,
  } as UserInfo;
}

export async function updateCurrentUserApi(data: UpdateCurrentUserParams) {
  return neyeApiRequest<CurrentUser>('/auth/me', {
    body: JSON.stringify(data),
    method: 'PATCH',
  });
}

export async function changeCurrentPasswordApi(
  data: ChangeCurrentPasswordParams,
) {
  return neyeApiRequest<{ message: string }>('/auth/password', {
    body: JSON.stringify(data),
    method: 'PATCH',
  });
}
