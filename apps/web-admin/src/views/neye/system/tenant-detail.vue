<script setup lang="ts">
import type {
  Account,
  PageResult,
  TenantDetail,
  TenantUser,
} from '#/types/neye';

import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import { apiRequest } from '#/api/neye';
import { formatDate, tenantStatusText } from '#/utils/neye-format';

import { validateDangerConfirmation } from './governance';

defineOptions({ name: 'NEyeTenantDetail' });

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => String(route.params.id));
const loading = ref(false);
const accountLoading = ref(false);
const accountOpen = ref(false);
const deleteOpen = ref(false);
const deleteLoading = ref(false);
const detail = ref<null | TenantDetail>(null);
const availableAccounts = ref<Account[]>([]);
const accountForm = reactive({ userId: '' });
const deleteForm = reactive({ confirmation: '' });
const accountColumns = [
  { dataIndex: 'username', key: 'username', title: '账号' },
  { dataIndex: 'displayName', key: 'displayName', title: '姓名' },
  { dataIndex: 'role', key: 'role', title: '角色', width: 90 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 90 },
  { dataIndex: 'assignedAt', key: 'assignedAt', title: '分配时间', width: 130 },
  { key: 'action', title: '操作', width: 100 },
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
    const assignedIds = new Set(
      (detail.value?.users ?? []).map((user) => user.id),
    );
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
    message.success('账号已分配到当前门店');
    accountOpen.value = false;
    await load();
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '账号分配失败，请刷新后重试',
    );
  }
}

function removeAssignment(user: TenantUser) {
  Modal.confirm({
    async onOk() {
      await apiRequest(`/tenants/${tenantId.value}/users/${user.id}`, {
        method: 'DELETE',
      });
      message.success('已移除当前门店分配，账号本身仍然保留');
      await load();
    },
    cancelText: '取消',
    content: `确认移除 ${user.username} 对当前门店的访问权限？`,
    okText: '移除',
    okType: 'danger',
    title: '移除账号',
  });
}

function removeTenant() {
  if (!detail.value) return;
  Object.assign(deleteForm, { confirmation: '' });
  deleteOpen.value = true;
}

async function submitDeleteTenant() {
  if (!detail.value) return;
  const validation = validateDangerConfirmation(
    deleteForm.confirmation,
    detail.value.name,
  );
  if (validation) {
    message.warning(validation);
    return;
  }
  deleteLoading.value = true;
  try {
    await apiRequest(`/tenants/${tenantId.value}`, {
      method: 'DELETE',
    });
    message.success('门店及关联业务数据已删除，独立账号已保留');
    deleteOpen.value = false;
    await router.push('/neye/system/tenants');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '门店删除失败');
  } finally {
    deleteLoading.value = false;
  }
}
onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <a-spin :spinning="loading">
      <div class="neye-page-head">
        <div>
          <h1 class="neye-page-title">{{ detail?.name || '门店详情' }}</h1>
          <p class="neye-page-subtitle">
            {{ detail?.code || '-' }} /
            {{ detail ? tenantStatusText(detail.status) : '-' }}
          </p>
        </div>
        <a-space>
          <a-button @click="router.push('/neye/system/tenants')">
            返回列表
          </a-button>
          <a-button :icon="h(ReloadOutlined)" @click="load">刷新</a-button>
          <a-button danger :icon="h(DeleteOutlined)" @click="removeTenant">
            删除门店
          </a-button>
        </a-space>
      </div>

      <div class="neye-stat-row">
        <div class="neye-stat-box">
          <div class="neye-stat-label">账号数</div>
          <div class="neye-stat-value">{{ detail?.counts.users ?? 0 }}</div>
        </div>
        <div class="neye-stat-box">
          <div class="neye-stat-label">客户数</div>
          <div class="neye-stat-value">{{ detail?.counts.customers ?? 0 }}</div>
        </div>
        <div class="neye-stat-box">
          <div class="neye-stat-label">验光单</div>
          <div class="neye-stat-value">
            {{ detail?.counts.optometryOrders ?? 0 }}
          </div>
        </div>
        <div class="neye-stat-box">
          <div class="neye-stat-label">配镜单</div>
          <div class="neye-stat-value">
            {{ detail?.counts.fittingOrders ?? 0 }}
          </div>
        </div>
      </div>

      <section class="neye-panel">
        <h2 class="neye-section-title">基础信息</h2>
        <div class="neye-detail-grid">
          <div>
            <span>门店编号</span><strong>{{ detail?.code || '-' }}</strong>
          </div>
          <div>
            <span>联系人</span><strong>{{ detail?.contactName || '-' }}</strong>
          </div>
          <div>
            <span>联系电话</span
            ><strong>{{ detail?.contactPhone || '-' }}</strong>
          </div>
          <div>
            <span>创建时间</span
            ><strong>{{ formatDate(detail?.createdAt) }}</strong>
          </div>
        </div>
      </section>

      <section class="neye-panel">
        <div class="neye-section-head">
          <h2 class="neye-section-title">门店账号</h2>
          <a-button
            type="primary"
            size="small"
            :icon="h(PlusOutlined)"
            @click="openAccount"
          >
            分配账号
          </a-button>
        </div>
        <a-table
          row-key="id"
          size="small"
          :columns="accountColumns"
          :data-source="detail?.users || []"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              {{ record.role === 'admin' ? '管理员' : '商家员工' }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '启用' : '停用' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'assignedAt'">
              {{ formatDate(record.assignedAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space>
                <a-button
                  danger
                  type="link"
                  class="neye-link-button"
                  :icon="h(DeleteOutlined)"
                  @click="removeAssignment(record)"
                >
                  移除
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </section>
    </a-spin>

    <a-modal
      v-model:open="accountOpen"
      title="分配门店账号"
      :footer="null"
      destroy-on-close
    >
      <a-form layout="vertical" :model="accountForm" @finish="submitAccount">
        <a-form-item
          label="选择已有账号"
          name="userId"
          :rules="[{ required: true, message: '请选择账号' }]"
        >
          <a-select
            v-model:value="accountForm.userId"
            show-search
            :loading="accountLoading"
            :options="accountOptions"
            placeholder="从账号管理中选择普通账号"
          />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit">保存</a-button
          ><a-button @click="accountOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>
    <a-modal
      v-model:open="deleteOpen"
      title="删除门店"
      :footer="null"
      destroy-on-close
    >
      <a-alert
        type="error"
        show-icon
        message="此操作会永久删除门店业务数据。"
        style="margin-bottom: 16px"
      />
      <a-form
        layout="vertical"
        :model="deleteForm"
        @finish="submitDeleteTenant"
      >
        <a-form-item
          :label="`\u8bf7\u8f93\u5165\u201c${detail?.name || ''}\u201d\u5b8c\u6210\u786e\u8ba4`"
          name="confirmation"
          :rules="[
            {
              required: true,
              message: '\u8bf7\u8f93\u5165\u786e\u8ba4\u5185\u5bb9',
            },
          ]"
        >
          <a-input v-model:value="deleteForm.confirmation" autocomplete="off" />
        </a-form-item>
        <a-space>
          <a-button
            danger
            type="primary"
            html-type="submit"
            :loading="deleteLoading"
          >
            {{ '\u6c38\u4e45\u5220\u9664' }}
          </a-button>
          <a-button @click="deleteOpen = false">{{ '\u53d6\u6d88' }}</a-button>
        </a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
