import { computed, ref, watch } from 'vue';

import { usePreferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { apiRequest } from '#/api/neye';
import type { CurrentUser, PageResult, Tenant } from '#/types/neye';

interface NeyeCustomPreferences {
  tenantMode?: 'multi' | 'single';
}

interface NeyeUserInfo {
  roles?: string[];
  tenantId?: null | string;
  tenants?: CurrentUser['tenants'];
}

const SELECTED_TENANT_KEY = 'neye.selectedTenantId';

const tenants = ref<Tenant[]>([]);
const selectedTenantId = ref(readStoredTenantId());
const tenantLoading = ref(false);
let loadedForUser = '';

watch(
  selectedTenantId,
  (tenantId) => {
    if (typeof window === 'undefined') return;
    if (tenantId) {
      window.localStorage.setItem(SELECTED_TENANT_KEY, tenantId);
    } else {
      window.localStorage.removeItem(SELECTED_TENANT_KEY);
    }
  },
  { flush: 'sync' },
);

export function useNeyeTenantScope() {
  const userStore = useUserStore();
  const { customPreferences } = usePreferences() as unknown as {
    customPreferences: Readonly<NeyeCustomPreferences>;
  };

  const currentUser = computed(() => (userStore.userInfo ?? {}) as NeyeUserInfo);
  const isAdmin = computed(() => currentUser.value.roles?.includes('admin') ?? false);
  const assignedTenants = computed(() => currentUser.value.tenants ?? []);
  const isTenantSelectorVisible = computed(
    () =>
      customPreferences.tenantMode === 'multi' &&
      (isAdmin.value || assignedTenants.value.filter((tenant) => tenant.status === 'active').length > 1),
  );
  const scopedTenantId = computed(() =>
    isTenantSelectorVisible.value
      ? selectedTenantId.value
      : currentUser.value.tenantId || selectedTenantId.value,
  );
  const isTenantReady = computed(() => Boolean(scopedTenantId.value) || isAdmin.value);
  const selectedTenant = computed(() => tenants.value.find((item) => item.id === scopedTenantId.value) ?? null);
  const tenantOptions = computed(() =>
    tenants.value
      .filter((tenant) => tenant.status === 'active')
      .map((tenant) => ({
        label: `${tenant.name} / ${tenant.code}`,
        value: tenant.id,
      })),
  );

  async function loadTenants(force = false) {
    const userKey = String((userStore.userInfo as { userId?: string } | null)?.userId ?? '');
    if (!force && loadedForUser === userKey && tenants.value.length > 0) return;

    tenantLoading.value = true;
    try {
      if (isAdmin.value) {
        const page = await apiRequest<PageResult<Tenant>>('/tenants?page=1&pageSize=100');
        tenants.value = page.items;
      } else {
        tenants.value = assignedTenants.value;
      }
      loadedForUser = userKey;

      const activeTenants = tenants.value.filter((tenant) => tenant.status === 'active');
      if (!activeTenants.some((tenant) => tenant.id === selectedTenantId.value)) {
        selectedTenantId.value = currentUser.value.tenantId || activeTenants[0]?.id || '';
      }
    } finally {
      tenantLoading.value = false;
    }
  }

  function appendTenantParam(params: URLSearchParams) {
    if (scopedTenantId.value) params.set('tenantId', scopedTenantId.value);
  }

  function withTenantPayload<T extends Record<string, unknown>>(payload: T): T & { tenantId?: string } {
    if (!scopedTenantId.value) return payload;
    return { ...payload, tenantId: scopedTenantId.value };
  }

  return {
    appendTenantParam,
    isTenantReady,
    isTenantSelectorVisible,
    loadTenants,
    scopedTenantId,
    selectedTenant,
    selectedTenantId,
    tenantLoading,
    tenantOptions,
    tenants,
    withTenantPayload,
  };
}

function readStoredTenantId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(SELECTED_TENANT_KEY) ?? '';
}