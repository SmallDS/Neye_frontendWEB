<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { LoaderCircle, Search, SearchX } from '@vben/icons';
import { usePreferences } from '@vben/preferences';
import { useDebounceFn } from '@vueuse/core';

import { apiRequest } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';
import type { Customer, PageResult } from '#/types/neye';

import {
  customerDetailPath,
  nextCustomerSearchIndex,
} from './customer-search';

defineOptions({ name: 'NeyeCustomerSearch' });

const router = useRouter();
const { globalSearchShortcutKey } = usePreferences();
const { appendTenantParam } = useNeyeTenantScope();

const open = ref(false);
const keyword = ref('');
const loading = ref(false);
const errorMessage = ref('');
const results = ref<Customer[]>([]);
const activeIndex = ref(-1);
const searchInputRef = ref<{ focus: () => void }>();
const resultsRoot = ref<HTMLElement>();
let requestVersion = 0;

const runSearch = useDebounceFn(searchCustomers, 250);

watch(keyword, (value) => {
  activeIndex.value = -1;
  errorMessage.value = '';
  if (!value.trim()) {
    requestVersion += 1;
    results.value = [];
    loading.value = false;
    return;
  }
  void runSearch();
});

async function searchCustomers() {
  const searchKeyword = keyword.value.trim();
  if (!searchKeyword) return;

  const currentVersion = ++requestVersion;
  loading.value = true;
  errorMessage.value = '';
  const params = new URLSearchParams({
    keyword: searchKeyword,
    page: '1',
    pageSize: '8',
  });
  appendTenantParam(params);

  try {
    const page = await apiRequest<PageResult<Customer>>(`/customers?${params}`);
    if (currentVersion !== requestVersion) return;
    results.value = page.items;
    activeIndex.value = page.items.length > 0 ? 0 : -1;
  } catch (error) {
    if (currentVersion !== requestVersion) return;
    results.value = [];
    activeIndex.value = -1;
    errorMessage.value =
      error instanceof Error ? error.message : '顾客搜索失败';
  } finally {
    if (currentVersion === requestVersion) loading.value = false;
  }
}

function openSearch() {
  open.value = true;
}

function handleOpenChange(isOpen: boolean) {
  if (isOpen) {
    void nextTick(() => searchInputRef.value?.focus());
    return;
  }
  requestVersion += 1;
  keyword.value = '';
  results.value = [];
  activeIndex.value = -1;
  loading.value = false;
  errorMessage.value = '';
}

function scrollActiveIntoView() {
  void nextTick(() => {
    resultsRoot.value
      ?.querySelector<HTMLElement>(
        `[data-customer-search-index="${activeIndex.value}"]`,
      )
      ?.scrollIntoView({ block: 'nearest' });
  });
}

function moveActive(direction: -1 | 1) {
  activeIndex.value = nextCustomerSearchIndex(
    activeIndex.value,
    results.value.length,
    direction,
  );
  scrollActiveIntoView();
}

async function selectCustomer(customer: Customer | undefined) {
  if (!customer) return;
  open.value = false;
  await router.push(customerDetailPath(customer.id));
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveActive(event.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    if (activeIndex.value >= 0) {
      void selectCustomer(results.value[activeIndex.value]);
    } else {
      void searchCustomers();
    }
    return;
  }
  if (event.key === 'Escape') open.value = false;
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (
    globalSearchShortcutKey.value &&
    event.key.toLowerCase() === 'k' &&
    (event.ctrlKey || event.metaKey)
  ) {
    event.preventDefault();
    openSearch();
  }
}

onMounted(() => window.addEventListener('keydown', handleWindowKeydown));
onBeforeUnmount(() =>
  window.removeEventListener('keydown', handleWindowKeydown),
);
</script>

<template>
  <div class="neye-customer-search">
    <button
      type="button"
      class="neye-customer-search-trigger"
      aria-label="顾客搜索"
      @click="openSearch"
    >
      <Search class="size-4" />
      <span class="hidden text-xs md:block">顾客搜索</span>
    </button>

    <a-modal
      v-model:open="open"
      :footer="null"
      :width="600"
      destroy-on-close
      title="顾客搜索"
      @after-open-change="handleOpenChange"
    >
      <a-input
        ref="searchInputRef"
        v-model:value="keyword"
        allow-clear
        autocomplete="off"
        placeholder="姓名 / 拼音首字母 / 手机号 / 客户编号"
        size="large"
        @keydown="handleInputKeydown"
      >
        <template #prefix>
          <Search class="mr-1 size-4 text-muted-foreground" />
        </template>
      </a-input>

      <div ref="resultsRoot" class="neye-customer-search-results">
        <div
          v-if="loading"
          class="neye-customer-search-state"
          aria-live="polite"
        >
          <LoaderCircle class="size-5 animate-spin" />
          <span>正在搜索</span>
        </div>

        <div
          v-else-if="errorMessage"
          class="neye-customer-search-state neye-customer-search-error"
        >
          {{ errorMessage }}
        </div>

        <div
          v-else-if="keyword.trim() && results.length === 0"
          class="neye-customer-search-state"
        >
          <SearchX class="size-6" />
          <span>未找到匹配顾客</span>
        </div>

        <div
          v-else-if="!keyword.trim()"
          class="neye-customer-search-state"
        >
          输入顾客信息开始搜索
        </div>

        <button
          v-for="(customer, index) in results"
          v-else
          :key="customer.id"
          type="button"
          class="neye-customer-search-result"
          :class="{ active: activeIndex === index }"
          :data-customer-search-index="index"
          @click="selectCustomer(customer)"
          @mouseenter="activeIndex = index"
        >
          <span class="neye-customer-search-name">{{ customer.name }}</span>
          <span class="neye-customer-search-meta">
            {{ customer.customerNo }}
            <template v-if="customer.phone"> · {{ customer.phone }}</template>
          </span>
        </button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.neye-customer-search-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: hsl(var(--accent));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}
.neye-customer-search-trigger:hover {
  color: hsl(var(--foreground));
}
.neye-customer-search-results {
  max-height: 420px;
  min-height: 180px;
  margin-top: 12px;
  overflow-y: auto;
}
.neye-customer-search-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}
.neye-customer-search-error {
  color: hsl(var(--destructive));
}
.neye-customer-search-result {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(120px, 0.8fr) minmax(220px, 1.4fr);
  align-items: center;
  min-height: 52px;
  padding: 8px 12px;
  border: 0;
  border-bottom: 1px solid hsl(var(--border));
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  text-align: left;
}
.neye-customer-search-result:hover,
.neye-customer-search-result.active {
  background: hsl(var(--accent));
}
.neye-customer-search-name {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neye-customer-search-meta {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .neye-customer-search-result {
    grid-template-columns: 1fr;
    gap: 3px;
  }
}
</style>