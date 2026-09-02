import type { RouteRecordStringComponent } from '@vben/types';

import { neyeApiRequest } from '#/api/neye';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  return neyeApiRequest<RouteRecordStringComponent[]>('/menu/all');
}
