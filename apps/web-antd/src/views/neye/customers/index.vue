<script setup lang="ts">
defineOptions({ name: 'NEyeCustomers' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabbarStore } from '@vben/stores';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { apiRequest, cleanPayload } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';
import type { BatchDeleteResult, Customer, Gender, PageResult } from '#/types/neye';
import { formatDate, genderText } from '#/utils/neye-format';

import {
  customerDetailLocation,
  customerListLocation,
  parseCustomerListState,
  staleCustomerListTabKeys,
} from '../customer-list-navigation';

const route = useRoute();
const router = useRouter();
const tabbarStore = useTabbarStore();
const initialListState = parseCustomerListState(route.query);
const loading = ref(false);
const createOpen = ref(false);
const editOpen = ref(false);
const editingCustomer = ref<Customer | null>(null);
const selectedRowKeys = ref<string[]>([]);
const selectedCount = computed(() => selectedRowKeys.value.length);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
}));
const query = reactive({ ...initialListState, pageSize: 10 });
const result = ref<PageResult<Customer>>({ items: [], total: 0, page: 1, pageSize: 10 });
const form = reactive<{ name: string; phone: string; gender: Gender; age?: number; remark: string }>({ name: '', phone: '', gender: 'unknown', age: undefined, remark: '' });
const editForm = reactive<{ name: string; phone: string; gender: Gender; age?: number; remark: string }>({ name: '', phone: '', gender: 'unknown', age: undefined, remark: '' });
const genderOptions = [{ value: 'unknown', label: '未知' }, { value: 'male', label: '男' }, { value: 'female', label: '女' }];
const {
  appendTenantParam,
  isTenantReady,
  isTenantSelectorVisible,
  loadTenants,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
  withTenantPayload,
} = useNeyeTenantScope();
const columns = [
  { title: '客户编号', dataIndex: 'customerNo', key: 'customerNo', width: 150 },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '性别', dataIndex: 'gender', key: 'gender', width: 90 },
  { title: '年龄', dataIndex: 'age', key: 'age', width: 90 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 210 },
];

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  selectedRowKeys.value = [];
  try {
    await router.replace(customerListLocation(query));
    await loadTenants();
    if (!isTenantReady.value) {
      result.value = { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      return;
    }
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.keyword) params.set('keyword', query.keyword);
    appendTenantParam(params);
    result.value = await apiRequest<PageResult<Customer>>(`/customers?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openCustomerDetail(customerId: string) {
  return router.push(
    customerDetailLocation(
      customerId,
      parseCustomerListState(route.query),
    ),
  );
}

function resetForm() {
  Object.assign(form, { name: '', phone: '', gender: 'unknown', age: undefined, remark: '' });
}

async function submitCreate() {
  if (!isTenantReady.value) {
    message.warning('请先选择租户');
    return;
  }
  try {
    const customer = await apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(cleanPayload(withTenantPayload(form))) });
    message.success('客户已创建');
    createOpen.value = false;
    resetForm();
    openCustomerDetail(customer.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  }
}

function openEdit(item: Customer) {
  editingCustomer.value = item;
  Object.assign(editForm, { name: item.name, phone: item.phone ?? '', gender: item.gender, age: item.age ?? undefined, remark: item.remark ?? '' });
  editOpen.value = true;
}

async function submitEdit() {
  if (!editingCustomer.value) return;
  try {
    await apiRequest<Customer>(`/customers/${editingCustomer.value.id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(editForm)) });
    message.success('客户已更新');
    editOpen.value = false;
    editingCustomer.value = null;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  }
}

function removeCustomer(item: Customer) {
  Modal.confirm({
    title: '删除客户',
    content: `确认删除客户「${item.name}」？已有验光单的客户不能删除。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await apiRequest(`/customers/${item.id}`, { method: 'DELETE' });
      message.success('客户已删除');
      await load(1);
    },
  });
}

function batchRemoveCustomers() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择客户');
    return;
  }
  Modal.confirm({
    title: '批量删除客户',
    content: `确认删除选中的 ${selectedRowKeys.value.length} 个客户？这些客户下的验光单和配镜单会一并删除。`,
    okText: '批量删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>('/customers/batch-delete', { method: 'POST', body: JSON.stringify(withTenantPayload({ ids: selectedRowKeys.value })) });
      message.success(`已删除 ${deleted.deletedCount} 个客户`);
      await load(1);
    },
  });
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}

async function closeStaleCustomerListTabs() {
  for (const key of staleCustomerListTabKeys(tabbarStore.tabs)) {
    await tabbarStore.closeTabByKey(key, router);
  }
}

function tenantFilterOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase());
}

onMounted(async () => {
  await closeStaleCustomerListTabs();
  await load();
});
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">客户管理</h1>
        <p class="neye-page-subtitle">客户、验光单和配镜单的入口</p>
      </div>
      <a-button type="primary" :disabled="!isTenantReady" :icon="h(PlusOutlined)" @click="createOpen = true">新建客户</a-button>
    </div>

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-select v-if="isTenantSelectorVisible" v-model:value="selectedTenantId" show-search :filter-option="tenantFilterOption" :loading="tenantLoading" :options="tenantOptions" placeholder="选择租户" class="neye-tenant-select" @change="load(1)" />
        <a-input v-model:value="query.keyword" allow-clear placeholder="姓名 / 拼音首字母 / 手机号 / 客户编号" style="width: 300px" @press-enter="load(1)" />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button danger :disabled="selectedCount === 0" :icon="h(DeleteOutlined)" @click="batchRemoveCustomers">批量删除{{ selectedCount ? ` ${selectedCount}` : '' }}</a-button>
      </div>
      <a-table row-key="id" :columns="columns" :data-source="result.items" :loading="loading" :pagination="{ current: query.page, pageSize: query.pageSize, total: result.total, showSizeChanger: false }" :row-selection="rowSelection" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'phone'">{{ record.phone || '-' }}</template>
          <template v-else-if="column.key === 'gender'">{{ genderText(record.gender) }}</template>
          <template v-else-if="column.key === 'age'">{{ record.age ?? '-' }}</template>
          <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" class="neye-link-button" @click="openCustomerDetail(record.id)">详情</a-button>
              <a-button type="link" class="neye-link-button" :icon="h(EditOutlined)" @click="openEdit(record)">编辑</a-button>
              <a-button danger type="link" class="neye-link-button" :icon="h(DeleteOutlined)" @click="removeCustomer(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal v-model:open="createOpen" title="新建客户" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="form" @finish="submitCreate">
        <div class="neye-form-grid">
          <a-form-item label="姓名" name="name" :rules="[{ required: true, message: '请填写姓名' }]"><a-input v-model:value="form.name" /></a-form-item>
          <a-form-item label="手机号" name="phone"><a-input v-model:value="form.phone" /></a-form-item>
          <a-form-item label="性别" name="gender"><a-select v-model:value="form.gender" :options="genderOptions" /></a-form-item>
          <a-form-item label="年龄" name="age"><a-input-number v-model:value="form.age" :min="0" :max="150" style="width: 100%" /></a-form-item>
        </div>
        <a-form-item label="备注" name="remark"><a-textarea v-model:value="form.remark" :rows="3" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="createOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editOpen" title="编辑客户" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="editForm" @finish="submitEdit">
        <div class="neye-form-grid">
          <a-form-item label="姓名" name="name" :rules="[{ required: true, message: '请填写姓名' }]"><a-input v-model:value="editForm.name" /></a-form-item>
          <a-form-item label="手机号" name="phone"><a-input v-model:value="editForm.phone" /></a-form-item>
          <a-form-item label="性别" name="gender"><a-select v-model:value="editForm.gender" :options="genderOptions" /></a-form-item>
          <a-form-item label="年龄" name="age"><a-input-number v-model:value="editForm.age" :min="0" :max="150" style="width: 100%" /></a-form-item>
        </div>
        <a-form-item label="备注" name="remark"><a-textarea v-model:value="editForm.remark" :rows="3" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="editOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>