<script setup lang="ts">
defineOptions({ name: 'NEyeTenants' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, EyeOutlined, KeyOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons-vue';
import { apiRequest, cleanPayload } from '#/api/neye';
import type { BatchDeleteResult, PageResult, Tenant, TenantStatus, TenantUser, UserStatus } from '#/types/neye';
import { formatDate, tenantStatusText } from '#/utils/neye-format';

const router = useRouter();
const loading = ref(false);
const createOpen = ref(false);
const editOpen = ref(false);
const accountOpen = ref(false);
const accountLoading = ref(false);
const userPasswordOpen = ref(false);
const editingTenant = ref<Tenant | null>(null);
const accountTenant = ref<Tenant | null>(null);
const passwordUser = ref<TenantUser | null>(null);
const tenantUsers = ref<TenantUser[]>([]);
const selectedRowKeys = ref<string[]>([]);
const selectedCount = computed(() => selectedRowKeys.value.length);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
}));
const query = reactive({ keyword: '', page: 1, pageSize: 10 });
const result = ref<PageResult<Tenant>>({ items: [], total: 0, page: 1, pageSize: 10 });
const form = reactive({ name: '', contactName: '', contactPhone: '', accountUsername: '', accountPassword: 'Shop123456', accountDisplayName: '' });
const editForm = reactive<{ name: string; contactName: string; contactPhone: string; status: TenantStatus }>({ name: '', contactName: '', contactPhone: '', status: 'active' });
const accountForm = reactive({ username: '', password: 'Shop123456', displayName: '' });
const userPasswordForm = reactive({ password: 'Shop123456' });
const columns = [
  { title: '租户编号', dataIndex: 'code', key: 'code', width: 190 },
  { title: '租户名称', dataIndex: 'name', key: 'name' },
  { title: '联系人', dataIndex: 'contactName', key: 'contactName', width: 140 },
  { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 360 },
];
const accountColumns = [
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
  { title: '角色', dataIndex: 'role', key: 'role', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 180 },
];

function userStatusText(status: UserStatus) {
  return status === 'active' ? '启用' : '停用';
}

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  selectedRowKeys.value = [];
  try {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    if (query.keyword) params.set('keyword', query.keyword);
    result.value = await apiRequest<PageResult<Tenant>>(`/tenants?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  try {
    await apiRequest('/tenants', { method: 'POST', body: JSON.stringify(cleanPayload(form)) });
    message.success('租户已创建');
    createOpen.value = false;
    Object.assign(form, { name: '', contactName: '', contactPhone: '', accountUsername: '', accountPassword: 'Shop123456', accountDisplayName: '' });
    await load(1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  }
}

function openEdit(item: Tenant) {
  editingTenant.value = item;
  Object.assign(editForm, { name: item.name, contactName: item.contactName ?? '', contactPhone: item.contactPhone ?? '', status: item.status });
  editOpen.value = true;
}

async function submitEdit() {
  if (!editingTenant.value) return;
  try {
    await apiRequest<Tenant>(`/tenants/${editingTenant.value.id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(editForm)) });
    message.success('租户已更新');
    editOpen.value = false;
    editingTenant.value = null;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  }
}

function toggleStatus(item: Tenant) {
  const nextStatus: TenantStatus = item.status === 'active' ? 'disabled' : 'active';
  Modal.confirm({
    title: nextStatus === 'active' ? '启用租户' : '停用租户',
    content: `${item.name} 将被${nextStatus === 'active' ? '启用' : '停用'}`,
    okText: '确认',
    cancelText: '取消',
    async onOk() {
      await apiRequest<Tenant>(`/tenants/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      message.success('状态已更新');
      await load();
    },
  });
}

function removeTenant(item: Tenant) {
  Modal.confirm({
    title: '删除租户',
    content: `确认删除租户「${item.name}」？该租户下账号、客户、验光单、配镜单会一并永久删除，商品字典不受影响。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>(`/tenants/${item.id}`, { method: 'DELETE' });
      message.success(`已删除 ${deleted.deletedCount} 个租户`);
      await load(1);
    },
  });
}

function batchRemoveTenants() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择租户');
    return;
  }
  Modal.confirm({
    title: '批量删除租户',
    content: `确认删除选中的 ${selectedRowKeys.value.length} 个租户？这些租户下账号、客户、验光单、配镜单会一并永久删除，商品字典不受影响。`,
    okText: '批量删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>('/tenants/batch-delete', { method: 'POST', body: JSON.stringify({ ids: selectedRowKeys.value }) });
      message.success(`已删除 ${deleted.deletedCount} 个租户`);
      await load(1);
    },
  });
}

async function loadTenantUsers(tenant: Tenant) {
  accountLoading.value = true;
  try {
    tenantUsers.value = await apiRequest<TenantUser[]>(`/tenants/${tenant.id}/users`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号加载失败');
  } finally {
    accountLoading.value = false;
  }
}

async function openAccounts(tenant: Tenant) {
  accountTenant.value = tenant;
  Object.assign(accountForm, { username: '', password: 'Shop123456', displayName: '' });
  accountOpen.value = true;
  await loadTenantUsers(tenant);
}

async function submitAccount() {
  if (!accountTenant.value) return;
  try {
    await apiRequest<TenantUser>(`/tenants/${accountTenant.value.id}/users`, { method: 'POST', body: JSON.stringify(cleanPayload(accountForm)) });
    message.success('账号已分配');
    Object.assign(accountForm, { username: '', password: 'Shop123456', displayName: '' });
    await loadTenantUsers(accountTenant.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号创建失败');
  }
}

function toggleUserStatus(user: TenantUser) {
  if (!accountTenant.value) return;
  const nextStatus: UserStatus = user.status === 'active' ? 'disabled' : 'active';
  Modal.confirm({
    title: nextStatus === 'active' ? '启用账号' : '停用账号',
    content: `${user.username} 将被${nextStatus === 'active' ? '启用' : '停用'}`,
    okText: '确认',
    cancelText: '取消',
    async onOk() {
      if (!accountTenant.value) return;
      await apiRequest<TenantUser>(`/tenants/${accountTenant.value.id}/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      message.success('账号状态已更新');
      await loadTenantUsers(accountTenant.value);
    },
  });
}

function openResetUserPassword(user: TenantUser) {
  passwordUser.value = user;
  userPasswordForm.password = 'Shop123456';
  userPasswordOpen.value = true;
}

async function submitResetUserPassword() {
  if (!accountTenant.value || !passwordUser.value) return;
  try {
    await apiRequest(`/tenants/${accountTenant.value.id}/users/${passwordUser.value.id}/password`, { method: 'PATCH', body: JSON.stringify(userPasswordForm) });
    message.success('账号密码已重置');
    userPasswordOpen.value = false;
    passwordUser.value = null;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重置失败');
  }
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">租户管理</h1>
        <p class="neye-page-subtitle">admin 管理全部租户，并为租户分配 staff 账号</p>
      </div>
      <a-button type="primary" :icon="h(PlusOutlined)" @click="createOpen = true">新建租户</a-button>
    </div>

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-input v-model:value="query.keyword" allow-clear placeholder="租户名称 / 编号" style="width: 280px" @press-enter="load(1)" />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button danger :disabled="selectedCount === 0" :icon="h(DeleteOutlined)" @click="batchRemoveTenants">批量删除{{ selectedCount ? ` ${selectedCount}` : '' }}</a-button>
      </div>
      <a-table row-key="id" :columns="columns" :data-source="result.items" :loading="loading" :pagination="{ current: query.page, pageSize: query.pageSize, total: result.total, showSizeChanger: false }" :row-selection="rowSelection" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ tenantStatusText(record.status) }}</a-tag></template>
          <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
          <template v-else-if="column.key === 'contactName'">{{ record.contactName || '-' }}</template>
          <template v-else-if="column.key === 'contactPhone'">{{ record.contactPhone || '-' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" class="neye-link-button" :icon="h(EyeOutlined)" @click="router.push(`/neye/system/tenants/${record.id}`)">详情</a-button>
              <a-button type="link" class="neye-link-button" :icon="h(TeamOutlined)" @click="openAccounts(record)">账号</a-button>
              <a-button type="link" class="neye-link-button" :icon="h(EditOutlined)" @click="openEdit(record)">编辑</a-button>
              <a-button type="link" class="neye-link-button" @click="toggleStatus(record)">{{ record.status === 'active' ? '停用' : '启用' }}</a-button>
              <a-button danger type="link" class="neye-link-button" :icon="h(DeleteOutlined)" @click="removeTenant(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal v-model:open="createOpen" title="新建租户" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="form" @finish="submitCreate">
        <div class="neye-form-grid">
          <a-form-item label="租户名称" name="name" :rules="[{ required: true, message: '请填写租户名称' }]"><a-input v-model:value="form.name" /></a-form-item>
          <a-form-item label="联系人" name="contactName"><a-input v-model:value="form.contactName" /></a-form-item>
          <a-form-item label="联系电话" name="contactPhone"><a-input v-model:value="form.contactPhone" /></a-form-item>
          <a-form-item label="账号姓名" name="accountDisplayName"><a-input v-model:value="form.accountDisplayName" /></a-form-item>
          <a-form-item label="账号" name="accountUsername"><a-input v-model:value="form.accountUsername" /></a-form-item>
          <a-form-item label="初始密码" name="accountPassword"><a-input-password v-model:value="form.accountPassword" /></a-form-item>
        </div>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="createOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editOpen" title="编辑租户" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="editForm" @finish="submitEdit">
        <a-form-item label="租户名称" name="name" :rules="[{ required: true, message: '请填写租户名称' }]"><a-input v-model:value="editForm.name" /></a-form-item>
        <a-form-item label="联系人" name="contactName"><a-input v-model:value="editForm.contactName" /></a-form-item>
        <a-form-item label="联系电话" name="contactPhone"><a-input v-model:value="editForm.contactPhone" /></a-form-item>
        <a-form-item label="状态" name="status"><a-select v-model:value="editForm.status" :options="[{ value: 'active', label: '启用' }, { value: 'disabled', label: '停用' }]" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="editOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>

    <a-modal v-model:open="accountOpen" :title="`${accountTenant?.name || ''}账号`" width="860px" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="accountForm" @finish="submitAccount">
        <div class="neye-form-grid">
          <a-form-item label="账号" name="username" :rules="[{ required: true, message: '请填写账号' }]"><a-input v-model:value="accountForm.username" /></a-form-item>
          <a-form-item label="姓名" name="displayName" :rules="[{ required: true, message: '请填写姓名' }]"><a-input v-model:value="accountForm.displayName" /></a-form-item>
          <a-form-item label="初始密码" name="password" :rules="[{ required: true, min: 6, message: '至少 6 位' }]"><a-input-password v-model:value="accountForm.password" /></a-form-item>
        </div>
        <a-space style="margin-bottom: 12px"><a-button type="primary" html-type="submit" :icon="h(PlusOutlined)">分配账号</a-button><a-button @click="accountTenant && loadTenantUsers(accountTenant)">刷新</a-button></a-space>
      </a-form>
      <a-table row-key="id" size="small" :columns="accountColumns" :data-source="tenantUsers" :loading="accountLoading" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">{{ record.role === 'admin' ? 'admin' : 'staff' }}</template>
          <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ userStatusText(record.status) }}</a-tag></template>
          <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" class="neye-link-button" @click="toggleUserStatus(record)">{{ record.status === 'active' ? '停用' : '启用' }}</a-button>
              <a-button type="link" class="neye-link-button" :icon="h(KeyOutlined)" @click="openResetUserPassword(record)">重置密码</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-modal>

    <a-modal v-model:open="userPasswordOpen" title="重置账号密码" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="userPasswordForm" @finish="submitResetUserPassword">
        <a-alert type="warning" show-icon style="margin-bottom: 12px" :message="`将重置 ${passwordUser?.username || ''} 的密码`" />
        <a-form-item label="新密码" name="password" :rules="[{ required: true, min: 6, message: '至少 6 位' }]"><a-input-password v-model:value="userPasswordForm.password" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit">确认重置</a-button><a-button @click="userPasswordOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>