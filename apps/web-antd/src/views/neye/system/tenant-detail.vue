<script setup lang="ts">
defineOptions({ name: 'NEyeTenantDetail' });

import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';

import { apiRequest } from '#/api/neye';
import type {
  Account,
  PageResult,
  TenantDetail,
  TenantUser,
} from '#/types/neye';
import { formatDate, money, tenantStatusText } from '#/utils/neye-format';
import { customerWorkspaceLocation } from '../customer-workspace';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => String(route.params.id));
const loading = ref(false);
const accountLoading = ref(false);
const accountOpen = ref(false);
const detail = ref<null | TenantDetail>(null);
const availableAccounts = ref<Account[]>([]);
const accountForm = reactive({ userId: '' });
const accountColumns = [
  { dataIndex: 'username', key: 'username', title: '账号' },
  { dataIndex: 'displayName', key: 'displayName', title: '姓名' },
  { dataIndex: 'role', key: 'role', title: '角色', width: 90 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 90 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 130 },
  { key: 'action', title: '操作', width: 100 },
];
const customerColumns = [
  { dataIndex: 'customerNo', key: 'customerNo', title: '客户编号', width: 150 },
  { dataIndex: 'name', key: 'name', title: '姓名' },
  { dataIndex: 'phone', key: 'phone', title: '手机号', width: 140 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 130 },
  { key: 'action', title: '操作', width: 80 },
];
const optometryColumns = [
  { dataIndex: 'orderNo', key: 'orderNo', title: '验光单号', width: 170 },
  { key: 'customer', title: '客户' },
  { dataIndex: 'optometryDate', key: 'optometryDate', title: '验光日期', width: 130 },
  { key: 'action', title: '操作', width: 80 },
];
const fittingColumns = [
  { dataIndex: 'orderNo', key: 'orderNo', title: '配镜单号', width: 170 },
  { key: 'customer', title: '客户' },
  { dataIndex: 'totalAmount', key: 'totalAmount', title: '金额', width: 120 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 130 },
  { key: 'action', title: '操作', width: 80 },
];
const accountOptions = computed(() =>
  availableAccounts.value.map((account) => ({
    label: `${account.displayName} / ${account.username}`,
    value: account.id,
  })),
);

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

async function openAccount() {
  accountForm.userId = '';
  accountOpen.value = true;
  accountLoading.value = true;
  try {
    const page = await apiRequest<PageResult<Account>>(
      '/users?page=1&pageSize=100&role=staff&status=active',
    );
    const assignedIds = new Set((detail.value?.users ?? []).map((user) => user.id));
    availableAccounts.value = page.items.filter(
      (account) => !assignedIds.has(account.id),
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号加载失败');
  } finally {
    accountLoading.value = false;
  }
}

async function submitAccount() {
  try {
    await apiRequest<TenantUser>(`/tenants/${tenantId.value}/users`, {
      body: JSON.stringify(accountForm),
      method: 'POST',
    });
    message.success('账号已分配');
    accountOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号分配失败');
  }
}

function removeAssignment(user: TenantUser) {
  Modal.confirm({
    async onOk() {
      await apiRequest(`/tenants/${tenantId.value}/users/${user.id}`, {
        method: 'DELETE',
      });
      message.success('已移除账号分配，账号本身仍然保留');
      await load();
    },
    cancelText: '取消',
    content: `确认移除 ${user.username} 对当前租户的访问权限？`,
    okText: '移除',
    okType: 'danger',
    title: '移除账号',
  });
}

function removeTenant() {
  if (!detail.value) return;
  Modal.confirm({
    async onOk() {
      await apiRequest(`/tenants/${tenantId.value}`, { method: 'DELETE' });
      message.success('租户及关联业务数据已删除，独立账号已保留');
      await router.push('/neye/system/tenants');
    },
    cancelText: '取消',
    content: `确认删除租户「${detail.value.name}」？该租户业务数据和账号分配关系会被永久删除，独立账号与商品字典不受影响。`,
    okText: '删除',
    okType: 'danger',
    title: '删除租户',
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
            <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status === 'active' ? '启用' : '停用' }}</a-tag></template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button danger type="link" class="neye-link-button" :icon="h(DeleteOutlined)" @click="removeAssignment(record)">移除</a-button>
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
                <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(customerWorkspaceLocation(record.customerId, record.id))">详情</a-button></template>
              </template>
            </a-table>
          </a-tab-pane>
          <a-tab-pane key="fitting" tab="配镜单">
            <a-table row-key="id" size="small" :columns="fittingColumns" :data-source="detail?.recentFittingOrders || []" :pagination="false">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'customer'">{{ record.customer?.name || '-' }}</template>
                <template v-else-if="column.key === 'totalAmount'"><span class="neye-money">{{ money(record.totalAmount) }}</span></template>
                <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
                <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(customerWorkspaceLocation(record.customerId, record.optometryOrderId, record.id))">详情</a-button></template>
              </template>
            </a-table>
          </a-tab-pane>
        </a-tabs>
      </section>
    </a-spin>

    <a-modal v-model:open="accountOpen" title="分配租户账号" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="accountForm" @finish="submitAccount">
        <a-form-item label="选择已有账号" name="userId" :rules="[{ required: true, message: '请选择账号' }]">
          <a-select v-model:value="accountForm.userId" show-search :loading="accountLoading" :options="accountOptions" placeholder="从账号管理中选择普通账号" />
        </a-form-item>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="accountOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>

  </div>
</template>

<style src="../neye.css"></style>