<script setup lang="ts">
defineOptions({ name: 'NEyeTenantDetail' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, KeyOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { apiRequest, cleanPayload } from '#/api/neye';
import type { TenantDetail, TenantUser, UserStatus } from '#/types/neye';
import { formatDate, money, tenantStatusText } from '#/utils/neye-format';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => String(route.params.id));
const loading = ref(false);
const accountOpen = ref(false);
const userPasswordOpen = ref(false);
const detail = ref<TenantDetail | null>(null);
const passwordUser = ref<TenantUser | null>(null);
const accountForm = reactive({ username: '', password: 'Shop123456', displayName: '' });
const userPasswordForm = reactive({ password: 'Shop123456' });
const accountColumns = [
  { title: '账号', dataIndex: 'username', key: 'username' },
  { title: '姓名', dataIndex: 'displayName', key: 'displayName' },
  { title: '角色', dataIndex: 'role', key: 'role', width: 90 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 180 },
];
const customerColumns = [
  { title: '客户编号', dataIndex: 'customerNo', key: 'customerNo', width: 150 },
  { title: '姓名', dataIndex: 'name', key: 'name' },
  { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 80 },
];
const optometryColumns = [
  { title: '验光单号', dataIndex: 'orderNo', key: 'orderNo', width: 170 },
  { title: '客户', key: 'customer' },
  { title: '验光日期', dataIndex: 'optometryDate', key: 'optometryDate', width: 130 },
  { title: '操作', key: 'action', width: 80 },
];
const fittingColumns = [
  { title: '配镜单号', dataIndex: 'orderNo', key: 'orderNo', width: 170 },
  { title: '客户', key: 'customer' },
  { title: '金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 80 },
];

function userStatusText(status: UserStatus) {
  return status === 'active' ? '启用' : '停用';
}

async function load() {
  loading.value = true;
  try {
    detail.value = await apiRequest<TenantDetail>(`/tenants/${tenantId.value}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openAccount() {
  Object.assign(accountForm, { username: '', password: 'Shop123456', displayName: '' });
  accountOpen.value = true;
}

async function submitAccount() {
  try {
    await apiRequest<TenantUser>(`/tenants/${tenantId.value}/users`, { method: 'POST', body: JSON.stringify(cleanPayload(accountForm)) });
    message.success('账号已分配');
    accountOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号创建失败');
  }
}

function toggleUserStatus(user: TenantUser) {
  const nextStatus: UserStatus = user.status === 'active' ? 'disabled' : 'active';
  Modal.confirm({
    title: nextStatus === 'active' ? '启用账号' : '停用账号',
    content: `${user.username} 将被${nextStatus === 'active' ? '启用' : '停用'}`,
    okText: '确认',
    cancelText: '取消',
    async onOk() {
      await apiRequest<TenantUser>(`/tenants/${tenantId.value}/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) });
      message.success('账号状态已更新');
      await load();
    },
  });
}

function openResetUserPassword(user: TenantUser) {
  passwordUser.value = user;
  userPasswordForm.password = 'Shop123456';
  userPasswordOpen.value = true;
}

async function submitResetUserPassword() {
  if (!passwordUser.value) return;
  try {
    await apiRequest(`/tenants/${tenantId.value}/users/${passwordUser.value.id}/password`, { method: 'PATCH', body: JSON.stringify(userPasswordForm) });
    message.success('账号密码已重置');
    userPasswordOpen.value = false;
    passwordUser.value = null;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重置失败');
  }
}

function removeTenant() {
  if (!detail.value) return;
  Modal.confirm({
    title: '删除租户',
    content: `确认删除租户「${detail.value.name}」？该租户下账号、客户、验光单、配镜单会一并永久删除，商品字典不受影响。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await apiRequest(`/tenants/${tenantId.value}`, { method: 'DELETE' });
      message.success('租户及关联数据已删除');
      router.push('/neye/system/tenants');
    },
  });
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <a-spin :spinning="loading">
      <div class="neye-page-head">
        <div>
          <h1 class="neye-page-title">{{ detail?.name || '租户详情' }}</h1>
          <p class="neye-page-subtitle">{{ detail?.code || '-' }} / {{ detail ? tenantStatusText(detail.status) : '-' }}</p>
        </div>
        <a-space>
          <a-button @click="router.push('/neye/system/tenants')">返回列表</a-button>
          <a-button :icon="h(ReloadOutlined)" @click="load">刷新</a-button>
          <a-button danger :icon="h(DeleteOutlined)" @click="removeTenant">删除租户</a-button>
        </a-space>
      </div>

      <div class="neye-stat-row">
        <div class="neye-stat-box"><div class="neye-stat-label">账号数</div><div class="neye-stat-value">{{ detail?.counts.users ?? 0 }}</div></div>
        <div class="neye-stat-box"><div class="neye-stat-label">客户数</div><div class="neye-stat-value">{{ detail?.counts.customers ?? 0 }}</div></div>
        <div class="neye-stat-box"><div class="neye-stat-label">验光单</div><div class="neye-stat-value">{{ detail?.counts.optometryOrders ?? 0 }}</div></div>
        <div class="neye-stat-box"><div class="neye-stat-label">配镜单</div><div class="neye-stat-value">{{ detail?.counts.fittingOrders ?? 0 }}</div></div>
      </div>

      <section class="neye-panel">
        <h2 class="neye-section-title">基础信息</h2>
        <div class="neye-detail-grid">
          <div><span>租户编号</span><strong>{{ detail?.code || '-' }}</strong></div>
          <div><span>联系人</span><strong>{{ detail?.contactName || '-' }}</strong></div>
          <div><span>联系电话</span><strong>{{ detail?.contactPhone || '-' }}</strong></div>
          <div><span>创建时间</span><strong>{{ formatDate(detail?.createdAt) }}</strong></div>
        </div>
      </section>

      <section class="neye-panel">
        <div class="neye-section-head">
          <h2 class="neye-section-title">租户账号</h2>
          <a-button type="primary" size="small" :icon="h(PlusOutlined)" @click="openAccount">分配账号</a-button>
        </div>
        <a-table row-key="id" size="small" :columns="accountColumns" :data-source="detail?.users || []" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">{{ record.role }}</template>
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
      </section>

      <section class="neye-panel">
        <h2 class="neye-section-title">最近业务数据</h2>
        <a-tabs>
          <a-tab-pane key="customers" tab="客户">
            <a-table row-key="id" size="small" :columns="customerColumns" :data-source="detail?.recentCustomers || []" :pagination="false">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'phone'">{{ record.phone || '-' }}</template>
                <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
                <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/customers/${record.id}`)">详情</a-button></template>
              </template>
            </a-table>
          </a-tab-pane>
          <a-tab-pane key="optometry" tab="验光单">
            <a-table row-key="id" size="small" :columns="optometryColumns" :data-source="detail?.recentOptometryOrders || []" :pagination="false">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'customer'">{{ record.customer?.name || '-' }}</template>
                <template v-else-if="column.key === 'optometryDate'">{{ formatDate(record.optometryDate) }}</template>
                <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/optometry-orders/${record.id}`)">详情</a-button></template>
              </template>
            </a-table>
          </a-tab-pane>
          <a-tab-pane key="fitting" tab="配镜单">
            <a-table row-key="id" size="small" :columns="fittingColumns" :data-source="detail?.recentFittingOrders || []" :pagination="false">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'customer'">{{ record.customer?.name || '-' }}</template>
                <template v-else-if="column.key === 'totalAmount'"><span class="neye-money">{{ money(record.totalAmount) }}</span></template>
                <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
                <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/fitting-orders/${record.id}`)">详情</a-button></template>
              </template>
            </a-table>
          </a-tab-pane>
        </a-tabs>
      </section>
    </a-spin>

    <a-modal v-model:open="accountOpen" title="分配租户账号" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="accountForm" @finish="submitAccount">
        <div class="neye-form-grid">
          <a-form-item label="账号" name="username" :rules="[{ required: true, message: '请填写账号' }]"><a-input v-model:value="accountForm.username" /></a-form-item>
          <a-form-item label="姓名" name="displayName" :rules="[{ required: true, message: '请填写姓名' }]"><a-input v-model:value="accountForm.displayName" /></a-form-item>
          <a-form-item label="初始密码" name="password" :rules="[{ required: true, min: 6, message: '至少 6 位' }]"><a-input-password v-model:value="accountForm.password" /></a-form-item>
        </div>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="accountOpen = false">取消</a-button></a-space>
      </a-form>
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