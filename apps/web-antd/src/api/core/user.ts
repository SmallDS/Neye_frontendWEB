import type { UserInfo } from '@vben/types';

import type { CurrentUser } from '#/types/neye';

import { preferences } from '@vben/preferences';

import { neyeApiRequest } from '#/api/neye';

export async function getUserInfoApi(): Promise<UserInfo> {
  const user = await neyeApiRequest<CurrentUser>('/auth/me');
  return {
    avatar: preferences.app.defaultAvatar,
    desc: user.tenant?.name ?? 'Admin',
    homePath: user.role === 'admin' ? '/neye/system/tenants' : '/neye/customers',
    realName: user.displayName,
    roles: [user.role],
    token: '',
    userId: user.id,
    username: user.username,
    tenant: user.tenant,
    tenantId: user.tenantId,
  } as UserInfo;
}