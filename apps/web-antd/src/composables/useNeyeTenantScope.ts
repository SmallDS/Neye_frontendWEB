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

interface UseNeyeTenantScopeOptions {
  forceTenantSelector?: boolean;
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

export function useNeyeTenantScope(options: UseNeyeTenantScopeOptions = {}) {
  const userStore = useUserStore();
  const { customPreferences } = usePreferences() as unknown as {
    customPreferences: Readonly<NeyeCustomPreferences>;
  };

  const currentUser = computed(() => (userStore.userInfo ?? {}) as NeyeUserInfo);
  const isAdmin = computed(() => currentUser.value.roles?.includes('admin') ?? false);
  const assignedTenants = computed(() => currentUser.value.tenants ?? []);
  const activeAssignedTenantCount = computed(
    () =>
      assignedTenants.value.filter((tenant) => tenant.status === 'active')
        .length,
  );
  const isTenantSelectorVisible = computed(() =>
    shouldShowTenantSelector({
      activeTenantCount: activeAssignedTenantCount.value,
      forceTenantSelector: options.forceTenantSelector === true,
      isAdmin: isAdmin.value,
      tenantMode: customPreferences.tenantMode,
    }),
  );
  const scopedTenantId = computed(() =>
    resolveScopedTenantId({
      currentTenantId: currentUser.value.tenantId,
      forceTenantSelector: options.forceTenantSelector === true,
      selectedTenantId: selectedTenantId.value,
      selectorVisible: isTenantSelectorVisible.value,
    }),
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

  async function loadTenants(force = false, autoSelect = true) {
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
        const currentTenantId = currentUser.value.tenantId;
        const hasCurrentTenant = activeTenants.some((tenant) => tenant.id === currentTenantId);
        selectedTenantId.value = hasCurrentTenant
          ? currentTenantId ?? ''
          : autoSelect
            ? activeTenants[0]?.id ?? ''
            : '';
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
    isAdmin,
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

export function shouldShowTenantSelector({
  activeTenantCount,
  forceTenantSelector,
  isAdmin,
  tenantMode,
}: {
  activeTenantCount: number;
  forceTenantSelector: boolean;
  isAdmin: boolean;
  tenantMode?: 'multi' | 'single';
}) {
  return (
    (forceTenantSelector || tenantMode === 'multi') &&
    (isAdmin || activeTenantCount > 1)
  );
}

export function resolveScopedTenantId({
  currentTenantId,
  forceTenantSelector,
  selectedTenantId,
  selectorVisible,
}: {
  currentTenantId?: null | string;
  forceTenantSelector: boolean;
  selectedTenantId: string;
  selectorVisible: boolean;
}) {
  return forceTenantSelector || selectorVisible
    ? selectedTenantId
    : currentTenantId || selectedTenantId;
}

function readStoredTenantId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(SELECTED_TENANT_KEY) ?? '';
}