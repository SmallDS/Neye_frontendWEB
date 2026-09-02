import type { CommercePermission } from '#/types/neye';

import { computed } from 'vue';

import { hasTenantPermission } from '@neye/api';

import { useNeyeTenantScope } from './useNeyeTenantScope';

export function useNeyePermissions() {
  const { selectedTenant } = useNeyeTenantScope();
  const permissions = computed(() => selectedTenant.value?.permissions ?? []);

  function can(permission: CommercePermission) {
    return hasTenantPermission(selectedTenant.value, permission);
  }

  function canAny(required: CommercePermission[]) {
    return required.some((permission) => can(permission));
  }

  return { can, canAny, permissions, selectedTenant };
}
