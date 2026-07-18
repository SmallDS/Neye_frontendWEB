<script setup lang="ts">
import type {
  Account,
  PageResult,
  Tenant,
  UserBatchStatusItem,
  UserRole,
  UserStatus,
} from '#/types/neye';

import { computed, h, onMounted, reactive, ref } from 'vue';

import {
  CheckCircleOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  SearchOutlined,
  ShopOutlined,
  StopOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

import { adminApi, apiRequest, cleanCreatePayload } from '#/api/neye';
import { formatDate } from '#/utils/neye-format';

import {
  summarizeBatchStatus,
  userStatusConfirmationText,
  validateDangerConfirmation,
} from './governance';

defineOptions({ name: 'NEyeUsers' });

const loading = ref(false);
const tenantLoading = ref(false);
const createOpen = ref(false);
const editOpen = ref(false);
const editDangerOpen = ref(false);
const editSubmitting = ref(false);
const assignmentOpen = ref(false);
const passwordOpen = ref(false);
const batchStatusOpen = ref(false);
const batchResultOpen = ref(false);
const batchSubmitting = ref(false);
const pendingEditPayload = ref<Record<string, unknown>>();
const editingAccount = ref<Account | null>(null);
const selectedRowKeys = ref<string[]>([]);
const query = reactive({
  keyword: '',
  page: 1,
  pageSize: 10,
  role: undefined as undefined | UserRole,
  status: undefined as undefined | UserStatus,
});
const result = ref<PageResult<Account>>({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
});
const tenants = ref<Tenant[]>([]);
const createForm = reactive({
  displayName: '',
  password: '',
  role: 'staff' as UserRole,
  tenantIds: [] as string[],
  username: '',
});
const editForm = reactive({
  displayName: '',
  role: 'staff' as UserRole,
  status: 'active' as UserStatus,
});
const assignmentForm = reactive({ tenantIds: [] as string[] });
const passwordForm = reactive({ password: '' });
const editDangerForm = reactive({ confirmation: '' });
const batchStatusForm = reactive({
  confirmation: '',
  status: 'disabled' as UserStatus,
});
const batchResults = ref<UserBatchStatusItem[]>([]);

const selectedCount = computed(() => selectedRowKeys.value.length);
const batchConfirmationText = computed(() =>
  userStatusConfirmationText(batchStatusForm.status),
);
const editDangerConfirmationText = computed(() =>
  editingAccount.value ? `确认变更 ${editingAccount.value.username}` : '',
);
const rowSelection = computed(() => ({
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
  selectedRowKeys: selectedRowKeys.value,
}));
const tenantOptions = computed(() =>
  tenants.value.map((tenant) => ({
    label: `${tenant.name} / ${tenant.code}`,
    value: tenant.id,
  })),
);
const columns = [
  { dataIndex: 'username', key: 'username', title: '账号', width: 170 },
  { dataIndex: 'displayName', key: 'displayName', title: '姓名', width: 150 },
  { dataIndex: 'role', key: 'role', title: '角色', width: 90 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 90 },
  { key: 'tenants', title: '已分配租户' },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 130 },
  { key: 'action', title: '操作', width: 260 },
];
const batchResultColumns = [
  { dataIndex: 'username', key: 'username', title: '账号' },
  { dataIndex: 'success', key: 'success', title: '结果', width: 90 },
  { dataIndex: 'message', key: 'message', title: '说明' },
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
    if (query.role) params.set('role', query.role);
    if (query.status) params.set('status', query.status);
    result.value = await apiRequest<PageResult<Account>>(`/users?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadTenants() {
  tenantLoading.value = true;
  try {
    const page = await apiRequest<PageResult<Tenant>>(
      '/tenants?page=1&pageSize=100',
    );
    tenants.value = page.items;
  } finally {
    tenantLoading.value = false;
  }
}

function openCreate() {
  Object.assign(createForm, {
    displayName: '',
    password: '',
    role: 'staff',
    tenantIds: [],
    username: '',
  });
  createOpen.value = true;
}

async function submitCreate() {
  try {
    await apiRequest<Account>('/users', {
      body: JSON.stringify({
        ...cleanCreatePayload(createForm),
        tenantIds: createForm.role === 'staff' ? createForm.tenantIds : [],
      }),
      method: 'POST',
    });
    message.success('账号已创建');
    createOpen.value = false;
    await load(1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号创建失败');
  }
}

function openEdit(account: Account) {
  editingAccount.value = account;
  Object.assign(editForm, {
    displayName: account.displayName,
    role: account.role,
    status: account.status,
  });
  editOpen.value = true;
}

function editPatch() {
  const account = editingAccount.value;
  if (!account) return {};
  const patch: Record<string, unknown> = {};
  const displayName = editForm.displayName.trim();
  if (displayName !== account.displayName) patch.displayName = displayName;
  if (editForm.role !== account.role) patch.role = editForm.role;
  if (editForm.status !== account.status) patch.status = editForm.status;
  return patch;
}

function isDangerousAdminEdit(patch: Record<string, unknown>) {
  const account = editingAccount.value;
  if (!account || account.role !== 'admin') return false;
  return (
    patch.role === 'staff' ||
    (account.status === 'active' && patch.status === 'disabled')
  );
}

async function performEdit(payload: Record<string, unknown>) {
  if (!editingAccount.value) return;
  editSubmitting.value = true;
  try {
    await apiRequest<Account>(`/users/${editingAccount.value.id}`, {
      body: JSON.stringify(payload),
      method: 'PATCH',
    });
    message.success('账号已更新');
    editDangerOpen.value = false;
    editOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账号更新失败');
  } finally {
    editSubmitting.value = false;
  }
}

async function submitEdit() {
  const patch = editPatch();
  if (Object.keys(patch).length === 0) {
    message.info('没有需要保存的变更');
    return;
  }
  if (isDangerousAdminEdit(patch)) {
    pendingEditPayload.value = patch;
    Object.assign(editDangerForm, { confirmation: '' });
    editDangerOpen.value = true;
    return;
  }
  await performEdit(patch);
}

async function submitDangerousEdit() {
  const payload = pendingEditPayload.value;
  if (!payload) return;
  const validation = validateDangerConfirmation(
    editDangerForm.confirmation,
    editDangerConfirmationText.value,
  );
  if (validation) {
    message.warning(validation);
    return;
  }
  await performEdit(payload);
}
function openAssignment(account: Account) {
  editingAccount.value = account;
  assignmentForm.tenantIds = account.tenants.map((tenant) => tenant.id);
  assignmentOpen.value = true;
}

async function submitAssignment() {
  if (!editingAccount.value) return;
  try {
    await apiRequest<Account>(`/users/${editingAccount.value.id}/tenants`, {
      body: JSON.stringify(assignmentForm),
      method: 'PUT',
    });
    message.success('租户分配已更新');
    assignmentOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '租户分配失败');
  }
}

function openPassword(account: Account) {
  editingAccount.value = account;
  passwordForm.password = '';
  passwordOpen.value = true;
}

async function submitPassword() {
  if (!editingAccount.value) return;
  try {
    await apiRequest(`/users/${editingAccount.value.id}/password`, {
      body: JSON.stringify(passwordForm),
      method: 'PATCH',
    });
    message.success('密码已重置');
    passwordOpen.value = false;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '密码重置失败');
  }
}

function openBatchStatus(status: UserStatus) {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择账号');
    return;
  }
  Object.assign(batchStatusForm, { confirmation: '', status });
  batchStatusOpen.value = true;
}

function batchStatusResultMessage(updated: boolean, status: UserStatus) {
  if (!updated) return '后端未返回该账号，状态可能未更新';
  return status === 'active' ? '已启用' : '已停用';
}

async function submitBatchStatus() {
  const confirmationText = batchConfirmationText.value;
  if (batchStatusForm.confirmation.trim() !== confirmationText) {
    message.warning(`请输入“${confirmationText}”完成二次确认`);
    return;
  }

  const selectedAccounts = new Map(
    result.value.items
      .filter((account) => selectedRowKeys.value.includes(account.id))
      .map((account) => [account.id, account]),
  );
  batchSubmitting.value = true;
  try {
    const response = await adminApi.updateUsersStatus({
      status: batchStatusForm.status,
      userIds: [...selectedRowKeys.value],
    });
    const updatedIds = new Set(response.userIds);
    batchResults.value = selectedRowKeys.value.map((userId) => ({
      message: batchStatusResultMessage(
        updatedIds.has(userId),
        batchStatusForm.status,
      ),
      success: updatedIds.has(userId),
      userId,
      username: selectedAccounts.get(userId)?.username || userId,
    }));
    const summary = summarizeBatchStatus(batchResults.value);
    message.success(
      `批量操作完成：成功 ${summary.succeeded}，失败 ${summary.failed}`,
    );
    batchStatusOpen.value = false;
    batchResultOpen.value = true;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '批量状态更新失败');
  } finally {
    batchSubmitting.value = false;
  }
}

function handleTableChange(pagination: { current?: number }) {
  void load(Number(pagination.current || 1));
}

onMounted(async () => {
  await Promise.all([load(1), loadTenants()]);
});
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">账号管理</h1>
        <p class="neye-page-subtitle">账号独立维护，可分配到一个或多个租户</p>
      </div>
      <a-button type="primary" :icon="h(PlusOutlined)" @click="openCreate">
        新建账号
      </a-button>
    </div>

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-input
          v-model:value="query.keyword"
          allow-clear
          placeholder="账号 / 姓名"
          style="width: 260px"
          @press-enter="load(1)"
        />
        <a-select
          v-model:value="query.role"
          allow-clear
          placeholder="角色"
          style="width: 120px"
          :options="[
            { label: '管理员', value: 'admin' },
            { label: '普通账号', value: 'staff' },
          ]"
        />
        <a-select
          v-model:value="query.status"
          allow-clear
          placeholder="状态"
          style="width: 120px"
          :options="[
            { label: '启用', value: 'active' },
            { label: '停用', value: 'disabled' },
          ]"
        />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button
          :disabled="!selectedCount"
          :icon="h(CheckCircleOutlined)"
          @click="openBatchStatus('active')"
          >批量启用</a-button
        >
        <a-button
          danger
          :disabled="!selectedCount"
          :icon="h(StopOutlined)"
          @click="openBatchStatus('disabled')"
          >批量停用</a-button
        >
        <span v-if="selectedCount" class="neye-muted">
          已选择 {{ selectedCount }} 个账号
        </span>
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
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'admin' ? 'blue' : 'default'">
              {{ record.role === 'admin' ? '管理员' : '普通账号' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 'active' ? 'green' : 'red'">
              {{ record.status === 'active' ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'tenants'">
            <a-space v-if="record.tenants.length" wrap>
              <a-tag v-for="tenant in record.tenants" :key="tenant.id">
                {{ tenant.name }}
              </a-tag>
            </a-space>
            <span v-else class="neye-muted">
              {{ record.role === 'admin' ? '全系统权限' : '未分配' }}
            </span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                v-if="record.role === 'staff'"
                type="link"
                class="neye-link-button"
                :icon="h(ShopOutlined)"
                @click="openAssignment(record)"
              >
                分配租户
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
                :icon="h(KeyOutlined)"
                @click="openPassword(record)"
              >
                重置密码
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="createOpen"
      title="新建账号"
      :footer="null"
      destroy-on-close
    >
      <a-form layout="vertical" :model="createForm" @finish="submitCreate">
        <div class="neye-form-grid">
          <a-form-item
            label="账号"
            name="username"
            :rules="[{ required: true, message: '请填写账号' }]"
          >
            <a-input v-model:value="createForm.username" autocomplete="off" />
          </a-form-item>
          <a-form-item
            label="姓名"
            name="displayName"
            :rules="[{ required: true, message: '请填写姓名' }]"
          >
            <a-input v-model:value="createForm.displayName" />
          </a-form-item>
          <a-form-item
            label="初始密码"
            name="password"
            :rules="[{ required: true, min: 6, message: '至少 6 位' }]"
          >
            <a-input-password
              v-model:value="createForm.password"
              autocomplete="new-password"
            />
          </a-form-item>
          <a-form-item label="角色" name="role">
            <a-select
              v-model:value="createForm.role"
              :options="[
                { label: '普通账号', value: 'staff' },
                { label: '管理员', value: 'admin' },
              ]"
            />
          </a-form-item>
        </div>
        <a-form-item v-if="createForm.role === 'staff'" label="分配租户">
          <a-select
            v-model:value="createForm.tenantIds"
            mode="multiple"
            show-search
            :loading="tenantLoading"
            :options="tenantOptions"
            placeholder="可暂不分配"
          />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit">保存</a-button>
          <a-button @click="createOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="editOpen"
      title="编辑账号"
      :footer="null"
      destroy-on-close
    >
      <a-form layout="vertical" :model="editForm" @finish="submitEdit">
        <a-form-item
          label="姓名"
          name="displayName"
          :rules="[{ required: true, message: '请填写姓名' }]"
        >
          <a-input v-model:value="editForm.displayName" />
        </a-form-item>
        <a-form-item label="角色" name="role">
          <a-select
            v-model:value="editForm.role"
            :options="[
              { label: '普通账号', value: 'staff' },
              { label: '管理员', value: 'admin' },
            ]"
          />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-select
            v-model:value="editForm.status"
            :options="[
              { label: '启用', value: 'active' },
              { label: '停用', value: 'disabled' },
            ]"
          />
        </a-form-item>
        <a-alert
          v-if="editingAccount?.role === 'staff' && editForm.role === 'admin'"
          type="warning"
          show-icon
          message="改为管理员后，将清除该账号的租户分配并获得全系统权限。"
          style="margin-bottom: 16px"
        />
        <a-space>
          <a-button type="primary" html-type="submit">保存</a-button>
          <a-button @click="editOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="assignmentOpen"
      title="分配租户"
      :footer="null"
      destroy-on-close
    >
      <a-form
        layout="vertical"
        :model="assignmentForm"
        @finish="submitAssignment"
      >
        <a-alert
          type="info"
          show-icon
          :message="`正在设置账号：${editingAccount?.username || '-'}`"
          style="margin-bottom: 16px"
        />
        <a-form-item label="可访问租户">
          <a-select
            v-model:value="assignmentForm.tenantIds"
            mode="multiple"
            show-search
            :loading="tenantLoading"
            :options="tenantOptions"
            placeholder="选择一个或多个租户"
          />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit">保存分配</a-button>
          <a-button @click="assignmentOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="passwordOpen"
      title="重置账号密码"
      :footer="null"
      destroy-on-close
    >
      <a-form layout="vertical" :model="passwordForm" @finish="submitPassword">
        <a-alert
          type="warning"
          show-icon
          :message="`将重置 ${editingAccount?.username || '-'} 的密码`"
          style="margin-bottom: 16px"
        />
        <a-form-item
          label="新密码"
          name="password"
          :rules="[{ required: true, min: 6, message: '至少 6 位' }]"
        >
          <a-input-password
            v-model:value="passwordForm.password"
            autocomplete="new-password"
          />
        </a-form-item>
        <a-space>
          <a-button type="primary" html-type="submit">确认重置</a-button>
          <a-button @click="passwordOpen = false">取消</a-button>
        </a-space>
      </a-form>
    </a-modal>
    <a-modal
      v-model:open="editDangerOpen"
      :title="'\u786e\u8ba4\u7ba1\u7406\u5458\u6743\u9650\u53d8\u66f4'"
      :footer="null"
      destroy-on-close
    >
      <a-form
        layout="vertical"
        :model="editDangerForm"
        @finish="submitDangerousEdit"
      >
        <a-alert
          type="warning"
          show-icon
          :message="'\u6b64\u53d8\u66f4\u4f1a\u7acb\u5373\u751f\u6548\uff0c\u8bf7\u6838\u5bf9\u786e\u8ba4\u5185\u5bb9\u3002'"
          style="margin-bottom: 16px"
        />
        <a-form-item
          :label="`\u8bf7\u8f93\u5165\u201c${editDangerConfirmationText}\u201d\u5b8c\u6210\u786e\u8ba4`"
          name="confirmation"
          :rules="[
            {
              required: true,
              message: '\u8bf7\u8f93\u5165\u786e\u8ba4\u5185\u5bb9',
            },
          ]"
        >
          <a-input
            v-model:value="editDangerForm.confirmation"
            autocomplete="off"
          />
        </a-form-item>
        <a-space>
          <a-button
            danger
            type="primary"
            html-type="submit"
            :loading="editSubmitting"
            >{{ '\u786e\u8ba4\u6267\u884c' }}</a-button
          >
          <a-button @click="editDangerOpen = false">{{
            '\u53d6\u6d88'
          }}</a-button>
        </a-space>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="batchStatusOpen"
      :title="
        batchStatusForm.status === 'active'
          ? '\u6279\u91cf\u542f\u7528\u8d26\u53f7'
          : '\u6279\u91cf\u505c\u7528\u8d26\u53f7'
      "
      :footer="null"
      destroy-on-close
    >
      <a-form
        layout="vertical"
        :model="batchStatusForm"
        @finish="submitBatchStatus"
      >
        <a-alert
          type="warning"
          show-icon
          :message="`\u6b64\u64cd\u4f5c\u5c06\u7acb\u5373\u5f71\u54cd ${selectedCount} \u4e2a\u8d26\u53f7\u3002`"
          style="margin-bottom: 16px"
        />
        <a-form-item
          :label="`\u8bf7\u8f93\u5165\u201c${batchConfirmationText}\u201d\u5b8c\u6210\u786e\u8ba4`"
          name="confirmation"
          :rules="[
            {
              required: true,
              message: '\u8bf7\u8f93\u5165\u786e\u8ba4\u5185\u5bb9',
            },
          ]"
        >
          <a-input
            v-model:value="batchStatusForm.confirmation"
            autocomplete="off"
          />
        </a-form-item>
        <a-space>
          <a-button
            :danger="batchStatusForm.status === 'disabled'"
            type="primary"
            html-type="submit"
            :loading="batchSubmitting"
            >{{ '\u786e\u8ba4\u6267\u884c' }}</a-button
          >
          <a-button @click="batchStatusOpen = false">{{
            '\u53d6\u6d88'
          }}</a-button>
        </a-space>
      </a-form>
    </a-modal>
    <a-modal
      v-model:open="batchResultOpen"
      title="批量操作结果"
      :footer="null"
      width="680px"
      destroy-on-close
    >
      <a-table
        row-key="userId"
        size="small"
        :columns="batchResultColumns"
        :data-source="batchResults"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'success'"
            ><a-tag :color="record.success ? 'green' : 'red'">{{
              record.success ? '成功' : '失败'
            }}</a-tag></template
          >
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
