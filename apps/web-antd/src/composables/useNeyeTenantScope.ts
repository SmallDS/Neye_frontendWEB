import { computed, ref, watch } from 'vue';

import { usePreferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { apiRequest } from '#/api/neye';
import type { PageResult, Tenant } from '#/types/neye';

interface NeyeCustomPreferences {
  tenantMode?: 'multi' | 'single';
}

const SELECTED_TENANT_KEY = 'neye.selectedTenantId';

const tenants = ref<Tenant[]>([]);
const selectedTenantId = ref(readStoredTenantId());
const tenantLoading = ref(false);
let tenantsLoaded = false;

watch(selectedTenantId, (tenantId) => {
  if (typeof window === 'undefined') return;
  if (tenantId) {
    window.localStorage.setItem(SELECTED_TENANT_KEY, tenantId);
  } else {
    window.localStorage.removeItem(SELECTED_TENANT_KEY);
  }
});

export function useNeyeTenantScope() {
  const userStore = useUserStore();
  const { customPreferences } = usePreferences() as unknown as {
    customPreferences: Readonly<NeyeCustomPreferences>;
  };

  const isAdmin = computed(() => userStore.userInfo?.roles?.includes('admin') ?? false);
  const isTenantSelectorVisible = computed(() => isAdmin.value && customPreferences.tenantMode === 'multi');
  const scopedTenantId = computed(() => (isTenantSelectorVisible.value ? selectedTenantId.value : ''));
  const isTenantReady = computed(() => !isTenantSelectorVisible.value || Boolean(selectedTenantId.value));
  const selectedTenant = computed(() => tenants.value.find((item) => item.id === selectedTenantId.value) ?? null);
  const tenantOptions = computed(() =>
    tenants.value.map((tenant) => ({
      label: `${tenant.name} / ${tenant.code}${tenant.status === 'disabled' ? ' / 停用' : ''}`,
      value: tenant.id,
    })),
  );

  async function loadTenants(force = false) {
    if (!isTenantSelectorVisible.value) return;
    if (tenantsLoaded && !force) return;

    tenantLoading.value = true;
    try {
      const page = await apiRequest<PageResult<Tenant>>('/tenants?page=1&pageSize=100');
      tenants.value = page.items;
      tenantsLoaded = true;
      if (!tenants.value.some((tenant) => tenant.id === selectedTenantId.value)) {
        selectedTenantId.value = tenants.value[0]?.id ?? '';
      }
    } finally {
      tenantLoading.value = false;
    }
  }

  function appendTenantParam(params: URLSearchParams) {
    if (scopedTenantId.value) {
      params.set('tenantId', scopedTenantId.value);
    }
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