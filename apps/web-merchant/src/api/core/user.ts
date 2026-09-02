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
      : (window.localStorage.getItem('neye.merchant.selectedTenantId') ?? '');
  const tenant =
    activeTenants.find((item) => item.id === storedTenantId) ??
    activeTenants[0];
  const tenantId = tenant?.id ?? '';
  if (typeof window !== 'undefined') {
    if (tenantId)
      window.localStorage.setItem('neye.merchant.selectedTenantId', tenantId);
    else window.localStorage.removeItem('neye.merchant.selectedTenantId');
  }
  let homePath = '/no-tenant';
  const tenantPermissions = tenant?.permissions ?? [];
  if (tenantId) {
    if (tenantPermissions.includes('customer.read')) {
      homePath = '/neye/customers';
    } else if (tenantPermissions.includes('fitting.read')) {
      homePath = '/neye/fitting-orders';
    } else if (tenantPermissions.includes('optometry.read')) {
      homePath = '/neye/optometry-orders';
    } else if (tenantPermissions.includes('checkout.read')) {
      homePath = '/neye/commerce/checkout';
    } else if (tenantPermissions.includes('inventory.read')) {
      homePath = '/neye/commerce/inventory';
    } else if (tenantPermissions.includes('commerce.settings')) {
      homePath = '/neye/store-settings/commerce';
    } else {
      homePath = '/profile';
    }
  }

  return {
    avatar: preferences.app.defaultAvatar,
    desc: tenant?.name ?? '管理员',
    homePath,
    realName: user.displayName,
    // Route authorities use the current store's permission codes alongside the
    // stable staff role. Switching stores reloads the shell so its menu is
    // regenerated for that store.
    roles: [user.role, ...tenantPermissions],
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
