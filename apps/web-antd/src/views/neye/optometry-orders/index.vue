<script setup lang="ts">
defineOptions({ name: 'NEyeOptometryOrders' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { apiRequest } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';
import type { BatchDeleteResult, OptometryOrder, PageResult } from '#/types/neye';
import { formatDate } from '#/utils/neye-format';

const router = useRouter();
const loading = ref(false);
const selectedRowKeys = ref<string[]>([]);
const selectedCount = computed(() => selectedRowKeys.value.length);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
}));
const query = reactive({ keyword: '', optometryDateFrom: '', optometryDateTo: '', page: 1, pageSize: 10 });
const result = ref<PageResult<OptometryOrder>>({ items: [], total: 0, page: 1, pageSize: 10 });
const {
  appendTenantParam,
  isTenantReady,
  isTenantSelectorVisible,
  loadTenants,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
} = useNeyeTenantScope();
const columns = [
  { title: '验光单号', dataIndex: 'orderNo', key: 'orderNo', width: 170 },
  { title: '客户', key: 'customer' },
  { title: '手机号', key: 'phone', width: 140 },
  { title: '验光日期', dataIndex: 'optometryDate', key: 'optometryDate', width: 130 },
  { title: '远用瞳距', dataIndex: 'farPd', key: 'farPd', width: 110 },
  { title: '近用瞳距', dataIndex: 'nearPd', key: 'nearPd', width: 110 },
  { title: '操作', key: 'action', width: 100 },
];

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  selectedRowKeys.value = [];
  try {
    await loadTenants();
    if (!isTenantReady.value) {
      result.value = { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      return;
    }
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.optometryDateFrom) params.set('optometryDateFrom', query.optometryDateFrom);
    if (query.optometryDateTo) params.set('optometryDateTo', query.optometryDateTo);
    appendTenantParam(params);
    result.value = await apiRequest<PageResult<OptometryOrder>>(`/optometry-orders?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function batchRemoveOptometryOrders() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择验光单');
    return;
  }
  Modal.confirm({
    title: '批量删除验光单',
    content: `确认删除选中的 ${selectedRowKeys.value.length} 张验光单？这些验光单下的配镜单会一并删除。`,
    okText: '批量删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>('/optometry-orders/batch-delete', { method: 'POST', body: JSON.stringify({ ids: selectedRowKeys.value, ...(isTenantSelectorVisible.value && selectedTenantId.value ? { tenantId: selectedTenantId.value } : {}) }) });
      message.success(`已删除 ${deleted.deletedCount} 张验光单`);
      await load(1);
    },
  });
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}

function tenantFilterOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase());
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">验光单</h1>
        <p class="neye-page-subtitle">按单号、客户、手机号和验光日期查询</p>
      </div>
    </div>

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-select v-if="isTenantSelectorVisible" v-model:value="selectedTenantId" show-search :filter-option="tenantFilterOption" :loading="tenantLoading" :options="tenantOptions" placeholder="选择租户" class="neye-tenant-select" @change="load(1)" />
        <a-input v-model:value="query.keyword" allow-clear placeholder="单号 / 客户 / 手机号" style="width: 300px" @press-enter="load(1)" />
        <a-input v-model:value="query.optometryDateFrom" type="date" style="width: 160px" />
        <a-input v-model:value="query.optometryDateTo" type="date" style="width: 160px" />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button danger :disabled="selectedCount === 0" :icon="h(DeleteOutlined)" @click="batchRemoveOptometryOrders">批量删除{{ selectedCount ? ` ${selectedCount}` : '' }}</a-button>
      </div>
      <a-table row-key="id" :columns="columns" :data-source="result.items" :loading="loading" :pagination="{ current: query.page, pageSize: query.pageSize, total: result.total, showSizeChanger: false }" :row-selection="rowSelection" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'customer'">{{ record.customer?.name || '-' }}</template>
          <template v-else-if="column.key === 'phone'">{{ record.customer?.phone || '-' }}</template>
          <template v-else-if="column.key === 'optometryDate'">{{ formatDate(record.optometryDate) }}</template>
          <template v-else-if="column.key === 'farPd'">{{ record.farPd || '-' }}</template>
          <template v-else-if="column.key === 'nearPd'">{{ record.nearPd || '-' }}</template>
          <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/optometry-orders/${record.id}`)">详情</a-button></template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<style src="../neye.css"></style>