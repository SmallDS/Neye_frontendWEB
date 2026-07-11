<script setup lang="ts">
defineOptions({ name: 'NEyeTenants' });

import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';

import { apiRequest, cleanPayload } from '#/api/neye';
import type {
  BatchDeleteResult,
  PageResult,
  Tenant,
  TenantStatus,
} from '#/types/neye';
import { formatDate, tenantStatusText } from '#/utils/neye-format';

const router = useRouter();
const loading = ref(false);
const createOpen = ref(false);
const editOpen = ref(false);
const editingTenant = ref<null | Tenant>(null);
const selectedRowKeys = ref<string[]>([]);
const selectedCount = computed(() => selectedRowKeys.value.length);
const rowSelection = computed(() => ({
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
  selectedRowKeys: selectedRowKeys.value,
}));
const query = reactive({ keyword: '', page: 1, pageSize: 10 });
const result = ref<PageResult<Tenant>>({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
});
const form = reactive({ contactName: '', contactPhone: '', name: '' });
const editForm = reactive<{
  contactName: string;
  contactPhone: string;
  name: string;
  status: TenantStatus;
}>({ contactName: '', contactPhone: '', name: '', status: 'active' });
const columns = [
  { dataIndex: 'code', key: 'code', title: '租户编号', width: 190 },
  { dataIndex: 'name', key: 'name', title: '租户名称' },
  { dataIndex: 'contactName', key: 'contactName', title: '联系人', width: 140 },
  { dataIndex: 'contactPhone', key: 'contactPhone', title: '联系电话', width: 150 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 130 },
  { key: 'action', title: '操作', width: 270 },
];

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  selectedRowKeys.value = [];
  try {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.keyword) params.set('keyword', query.keyword);
    result.value = await apiRequest<PageResult<Tenant>>(`/tenants?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  Object.assign(form, { contactName: '', contactPhone: '', name: '' });
  createOpen.value = true;
}

async function submitCreate() {
  try {
    await apiRequest('/tenants', {
      body: JSON.stringify(cleanPayload(form)),
      method: 'POST',
    });
    message.success('租户已创建，可在账号管理中分配账号');
    createOpen.value = false;
    await load(1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  }
}

function openEdit(item: Tenant) {
  editingTenant.value = item;
  Object.assign(editForm, {
    contactName: item.contactName ?? '',
    contactPhone: item.contactPhone ?? '',
    name: item.name,
    status: item.status,
  });
  editOpen.value = true;
}

async function submitEdit() {
  if (!editingTenant.value) return;
  try {
    await apiRequest<Tenant>(`/tenants/${editingTenant.value.id}`, {
      body: JSON.stringify(cleanPayload(editForm)),
      method: 'PATCH',
    });
    message.success('租户已更新');
    editOpen.value = false;
    editingTenant.value = null;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  }
}

function toggleStatus(item: Tenant) {
  const nextStatus: TenantStatus =
    item.status === 'active' ? 'disabled' : 'active';
  Modal.confirm({
    async onOk() {
      await apiRequest<Tenant>(`/tenants/${item.id}`, {
        body: JSON.stringify({ status: nextStatus }),
        method: 'PATCH',
      });
      message.success('状态已更新');
      await load();
    },
    cancelText: '取消',
    content: `${item.name} 将被${nextStatus === 'active' ? '启用' : '停用'}`,
    okText: '确认',
    title: nextStatus === 'active' ? '启用租户' : '停用租户',
  });
}

function removeTenant(item: Tenant) {
  Modal.confirm({
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>(
        `/tenants/${item.id}`,
        { method: 'DELETE' },
      );
      message.success(`已删除 ${deleted.deletedCount} 个租户`);
      await load(1);
    },
    cancelText: '取消',
    content: `确认删除租户「${item.name}」？该租户业务数据与账号分配关系会被永久删除，独立账号和商品字典不受影响。`,
    okText: '删除',
    okType: 'danger',
    title: '删除租户',
  });
}

function batchRemoveTenants() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择租户');
    return;
  }
  Modal.confirm({
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>(
        '/tenants/batch-delete',
        {
          body: JSON.stringify({ ids: selectedRowKeys.value }),
          method: 'POST',
        },
      );
      message.success(`已删除 ${deleted.deletedCount} 个租户`);
      await load(1);
    },
    cancelText: '取消',
    content: `确认删除选中的 ${selectedRowKeys.value.length} 个租户？业务数据与账号分配关系会被永久删除，独立账号和商品字典不受影响。`,
    okText: '批量删除',
    okType: 'danger',
    title: '批量删除租户',
  });
}

function handleTableChange(pagination: { current?: number }) {
  void load(Number(pagination.current || 1));
}

onMounted(() => load(1));
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">租户管理</h1>
        <p class="neye-page-subtitle">租户独立维护，账号在账号管理中统一分配</p>
      </div>
      <a-button type="primary" :icon="h(PlusOutlined)" @click="openCreate">
        新建租户
      </a-button>
    </div>

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-input
          v-model:value="query.keyword"
          allow-clear
          placeholder="租户名称 / 编号"
          style="width: 280px"
          @press-enter="load(1)"
        />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button
          danger
          :disabled="selectedCount === 0"
          :icon="h(DeleteOutlined)"
          @click="batchRemoveTenants"
        >
          批量删除{{ selectedCount ? ` ${selectedCount}` : '' }}
        </a-button>
      </div>
      <a-table
        row-key="id"
        :columns="columns"
        :data-source="result.items"
        :loading="loading"
        :pagination="{
          current: query.page,
          pageSize: query.pageSize,
          total: result.total,
          showSizeChanger: false,
        }"
        :row-selection="rowSelection"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'red'">
              {{ tenantStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'contactName'">
            {{ record.contactName || '-' }}
          </template>
          <template v-else-if="column.key === 'contactPhone'">
            {{ record.contactPhone || '-' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                type="link"
                class="neye-link-button"
                :icon="h(EyeOutlined)"
                @click="router.push(`/neye/system/tenants/${record.id}`)"
              >
                详情
              </a-button>
              <a-button
                type="link"
                class="neye-link-button"
                :icon="h(EditOutlined)"
                @click="openEdit(record)"
              >
                编辑
              </a-button>
              <a-button
                type="link"
                class="neye-link-button"
                @click="toggleStatus(record)"
              >
                {{ record.status === 'active' ? '停用' : '启用' }}
              </a-button>
              <a-button
                danger
                type="link"
                class="neye-link-button"
                :icon="h(DeleteOutlined)"
                @click="removeTenant(record)"
              >
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal v-model:open="createOpen" title="新建租户" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="form" @finish="submitCreate">
        <a-form-item label="租户名称" name="name" :rules="[{ required: true, message: '请填写租户名称' }]">
          <a-input v-model:value="form.name" />
        </a-form-item>
        <div class="neye-form-grid">
          <a-form-item label="联系人" name="contactName">
            <a-input v-model:value="form.contactName" />
          </a-form-item>
          <a-form-item label="联系电话" name="contactPhone">
            <a-input v-model:value="form.contactPhone" />
          </a-form-item>
        </div>
        <a-space>
          <a-button type="primary" html-type="submit">保存</a-button>
          <a-button @click="createOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editOpen" title="编辑租户" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="editForm" @finish="submitEdit">
        <a-form-item label="租户名称" name="name" :rules="[{ required: true, message: '请填写租户名称' }]">
          <a-input v-model:value="editForm.name" />
        </a-form-item>
        <div class="neye-form-grid">
          <a-form-item label="联系人" name="contactName">
            <a-input v-model:value="editForm.contactName" />
          </a-form-item>
          <a-form-item label="联系电话" name="contactPhone">
            <a-input v-model:value="editForm.contactPhone" />
          </a-form-item>
        </div>
        <a-form-item label="状态" name="status">
          <a-select
            v-model:value="editForm.status"
            :options="[
              { label: '启用', value: 'active' },
              { label: '停用', value: 'disabled' },
            ]"
          />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit">保存</a-button>
          <a-button @click="editOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>