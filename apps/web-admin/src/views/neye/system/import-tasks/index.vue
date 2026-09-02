<script setup lang="ts">
import type {
  ImportCapabilities,
  ImportTask,
  ImportTaskStatus,
  PageResult,
} from '#/types/neye';

import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  DeleteOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  RollbackOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

import { apiBlob, apiRequest, importTasksApi } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';
import { formatDate } from '#/utils/neye-format';

import {
  createIdempotencyKey,
  DEFAULT_IMPORT_CAPABILITIES,
  formatImportFileSize,
  isSupportedImportFile,
  validateDangerConfirmation,
} from '../governance';
import ImportTaskDangerModal from './components/ImportTaskDangerModal.vue';
import ImportTaskDetailModal from './components/ImportTaskDetailModal.vue';
import {
  canCancelImportTask,
  canDeleteImportTask,
  canRollbackImportTask,
  importTaskErrorLogs,
  importTaskRollbackSummary,
  isImportTaskActive,
  progressPercent,
  progressStatus,
  taskIdOf,
  taskPhaseText,
  taskProgressText,
  taskStatusInfo,
} from './view';

defineOptions({ name: 'NEyeImportTasks' });

const loading = ref(false);
const capabilities = ref<ImportCapabilities>({
  ...DEFAULT_IMPORT_CAPABILITIES,
});
const uploading = ref(false);
const downloading = ref(false);
const detailOpen = ref(false);
const detailLoading = ref(false);
const rollbackLoadingId = ref<string>();
const dangerOpen = ref(false);
const dangerLoading = ref(false);
type ImportDangerKind = 'cancel' | 'delete' | 'rollback';
const dangerAction = ref<{
  kind: ImportDangerKind;
  task: ImportTask;
  title: string;
}>();
const currentTask = ref<ImportTask | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const pendingUpload = ref<{ file: File; idempotencyKey: string }>();
const uploadError = ref('');
const result = ref<PageResult<ImportTask>>({
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
});
const query = ref({
  page: 1,
  pageSize: 10,
  status: undefined as ImportTaskStatus | undefined,
});
let refreshTimer: number | undefined;
let listRequestVersion = 0;
let detailRequestVersion = 0;
let refreshInFlight = false;

const {
  isTenantReady,
  loadTenants,
  selectedTenant,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
} = useNeyeTenantScope();

const canAutoRefresh = computed(
  () =>
    result.value.items.some(isImportTaskActive) ||
    (currentTask.value ? isImportTaskActive(currentTask.value) : false),
);

const errorLogs = computed(() => importTaskErrorLogs(currentTask.value));
const rollbackSummary = computed(() =>
  importTaskRollbackSummary(currentTask.value),
);

const columns = [
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
  { title: '租户', dataIndex: 'tenant', key: 'tenant', width: 180 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '进度', key: 'progress', width: 190 },
  { title: '结果', key: 'result', width: 190 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
  { title: '操作', key: 'action', width: 280 },
];

async function loadCapabilities() {
  try {
    capabilities.value = await importTasksApi.getCapabilities();
  } catch (error) {
    capabilities.value = { ...DEFAULT_IMPORT_CAPABILITIES };
    message.warning(
      error instanceof Error
        ? error.message
        : '无法读取导入能力，已使用安全默认值',
    );
  }
}
async function load(page = query.value.page) {
  const requestVersion = ++listRequestVersion;
  loading.value = true;
  query.value.page = page;
  try {
    await loadTenants();
    if (!isTenantReady.value || !selectedTenantId.value) {
      if (requestVersion === listRequestVersion) {
        result.value = {
          items: [],
          total: 0,
          page: query.value.page,
          pageSize: query.value.pageSize,
        };
      }
      return;
    }
    const params = new URLSearchParams({
      page: String(query.value.page),
      pageSize: String(query.value.pageSize),
    });
    if (query.value.status) params.set('status', query.value.status);
    const nextResult = await apiRequest<PageResult<ImportTask>>(
      `/import-tasks?${params}`,
      { tenantId: selectedTenantId.value },
    );
    if (requestVersion === listRequestVersion) result.value = nextResult;
  } catch (error) {
    if (requestVersion === listRequestVersion) {
      message.error(
        error instanceof Error ? error.message : '导入任务加载失败',
      );
    }
  } finally {
    if (requestVersion === listRequestVersion) loading.value = false;
  }
}

function tenantFilterOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '')
    .toLowerCase()
    .includes(input.toLowerCase());
}

function chooseFile() {
  if (!selectedTenantId.value) {
    message.warning('请先选择租户');
    return;
  }
  fileInput.value?.click();
}

async function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  if (!/\.xlsx?$/i.test(file.name)) {
    message.warning('只支持 xlsx / xls 文件');
    return;
  }
  if (!isSupportedImportFile(file, capabilities.value)) {
    message.warning(
      `文件不能超过 ${formatImportFileSize(capabilities.value.maxFileBytes)}`,
    );
    return;
  }
  try {
    pendingUpload.value = { file, idempotencyKey: createIdempotencyKey() };
    uploadError.value = '';
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '无法生成安全上传标识',
    );
    return;
  }
  await uploadPendingFile();
}

async function uploadPendingFile() {
  if (!selectedTenantId.value) {
    message.warning('请先选择租户');
    return;
  }
  const pending = pendingUpload.value;
  if (!pending) {
    message.warning('请重新选择导入文件');
    return;
  }
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('file', pending.file);
    const task = await importTasksApi.createCustomerOptometry(
      formData,
      pending.idempotencyKey,
      selectedTenantId.value,
    );
    pendingUpload.value = undefined;
    uploadError.value = '';
    message.success('导入任务已创建');
    await load(1);
    await openDetail(task.id);
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : '上传失败';
    message.error(`${uploadError.value}；可直接重试，系统将复用本次幂等标识`);
  } finally {
    uploading.value = false;
  }
}
async function downloadTemplate() {
  downloading.value = true;
  try {
    const blob = await apiBlob('/import-tasks/template/customer-optometry');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '客户验光单导入模板.xlsx';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '模板下载失败');
  } finally {
    downloading.value = false;
  }
}

async function downloadErrorReport(task: ImportTask) {
  try {
    const blob = await importTasksApi.getErrorReport(
      task.id,
      selectedTenantId.value,
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${task.fileName}-errors.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '错误报告下载失败');
  }
}
async function openDetail(taskOrId: ImportTask | string) {
  const id = typeof taskOrId === 'string' ? taskOrId : taskIdOf(taskOrId);
  if (!id) {
    message.error('任务ID缺失');
    return;
  }
  currentTask.value = typeof taskOrId === 'string' ? null : taskOrId;
  detailOpen.value = true;
  await loadDetail(id);
}

async function loadDetail(
  id = currentTask.value ? taskIdOf(currentTask.value) : undefined,
) {
  if (!id) return;
  const requestVersion = ++detailRequestVersion;
  detailLoading.value = true;
  try {
    const task = await apiRequest<ImportTask>(`/import-tasks/${id}`, {
      tenantId: selectedTenantId.value,
    });
    if (requestVersion === detailRequestVersion) currentTask.value = task;
  } catch (error) {
    if (requestVersion === detailRequestVersion) {
      message.error(
        error instanceof Error ? error.message : '任务详情加载失败',
      );
    }
  } finally {
    if (requestVersion === detailRequestVersion) detailLoading.value = false;
  }
}

function openDanger(task: ImportTask, kind: ImportDangerKind) {
  const titles: Record<ImportDangerKind, string> = {
    cancel: '取消导入任务',
    delete: '删除导入任务',
    rollback: '回滚导入数据',
  };
  dangerAction.value = { kind, task, title: titles[kind] };
  dangerOpen.value = true;
}

function cancelTask(task: ImportTask) {
  openDanger(task, 'cancel');
}

function rollbackTask(task: ImportTask) {
  openDanger(task, 'rollback');
}

function removeTask(task: ImportTask) {
  openDanger(task, 'delete');
}

async function submitDangerAction(confirmation: string) {
  const action = dangerAction.value;
  if (!action) return;
  const id = taskIdOf(action.task);
  if (!id) {
    message.error('任务 ID 缺失');
    return;
  }
  const validation = validateDangerConfirmation(
    confirmation,
    action.task.fileName,
  );
  if (validation) {
    message.warning(validation);
    return;
  }

  dangerLoading.value = true;
  if (action.kind === 'rollback') rollbackLoadingId.value = id;
  try {
    const options = {
      method: action.kind === 'delete' ? 'DELETE' : 'POST',
      tenantId: selectedTenantId.value,
    };
    if (action.kind === 'cancel') {
      await apiRequest(`/import-tasks/${id}/cancel`, options);
      message.success('已提交取消请求');
    } else if (action.kind === 'rollback') {
      const rolledBack = await apiRequest<ImportTask>(
        `/import-tasks/${id}/rollback`,
        options,
      );
      message.success(
        `已回滚：客户 ${rolledBack.rollbackCustomers || 0}，验光单 ${rolledBack.rollbackOptometryOrders || 0}`,
      );
      if (currentTask.value && taskIdOf(currentTask.value) === id) {
        currentTask.value = rolledBack;
      }
    } else {
      await apiRequest(`/import-tasks/${id}`, options);
      message.success('导入任务已删除');
      if (currentTask.value && taskIdOf(currentTask.value) === id) {
        detailOpen.value = false;
      }
    }
    dangerOpen.value = false;
    await load(action.kind === 'delete' ? 1 : query.value.page);
    if (
      action.kind !== 'delete' &&
      currentTask.value &&
      taskIdOf(currentTask.value) === id
    ) {
      await loadDetail(id);
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '任务治理操作失败');
  } finally {
    dangerLoading.value = false;
    rollbackLoadingId.value = undefined;
  }
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}

async function refreshActiveTasks() {
  if (
    refreshInFlight ||
    loading.value ||
    !canAutoRefresh.value ||
    document.visibilityState === 'hidden'
  ) {
    return;
  }

  refreshInFlight = true;
  try {
    await load();
    if (
      !detailLoading.value &&
      currentTask.value &&
      isImportTaskActive(currentTask.value)
    ) {
      await loadDetail(currentTask.value.id);
    }
  } finally {
    refreshInFlight = false;
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') void refreshActiveTasks();
}

onMounted(async () => {
  await loadCapabilities();
  await load();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  refreshTimer = window.setInterval(() => void refreshActiveTasks(), 2500);
});

onBeforeUnmount(() => {
  listRequestVersion += 1;
  detailRequestVersion += 1;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (refreshTimer) window.clearInterval(refreshTimer);
});
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">导入任务</h1>
        <p class="neye-page-subtitle">admin 按租户导入客户与验光单</p>
      </div>
      <a-space>
        <a-button
          :loading="downloading"
          :icon="h(DownloadOutlined)"
          @click="downloadTemplate"
        >
          下载模板
        </a-button>
        <a-button
          v-if="pendingUpload && uploadError"
          :loading="uploading"
          :icon="h(ReloadOutlined)"
          @click="uploadPendingFile"
        >
          重试上传
        </a-button>
        <a-button
          type="primary"
          :disabled="!selectedTenantId"
          :loading="uploading"
          :icon="h(UploadOutlined)"
          @click="chooseFile"
        >
          选择并上传
        </a-button>
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          style="display: none"
          @change="onFileChange"
        />
      </a-space>
    </div>

    <a-alert
      type="info"
      show-icon
      message="上传与任务治理规则"
      :description="`仅支持 xlsx / xls，单文件不超过 ${formatImportFileSize(capabilities.maxFileBytes)}、最多 ${capabilities.maxSheets} 个工作表；目标工作表最多 ${capabilities.maxRows} 条数据、${capabilities.maxColumns} 列。XLSX 会在后台受容量限制解析，并按 ${capabilities.batchSize} 行分批处理；运行中的任务可取消，发布阶段不可取消。`"
      style="margin-bottom: 16px"
    />

    <a-alert
      v-if="pendingUpload && uploadError"
      type="error"
      show-icon
      message="上次上传未完成"
      :description="`${pendingUpload.file.name}：${uploadError}。点击“重试上传”会复用同一幂等标识，避免重复创建任务；重新选择文件会生成新标识。`"
      style="margin-bottom: 16px"
    />

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-select
          v-model:value="selectedTenantId"
          show-search
          :filter-option="tenantFilterOption"
          :loading="tenantLoading"
          :options="tenantOptions"
          placeholder="选择租户"
          class="neye-tenant-select"
          @change="load(1)"
        />
        <a-select
          v-model:value="query.status"
          allow-clear
          placeholder="任务状态"
          style="width: 140px"
          :options="[
            { label: '等待中', value: 'pending' },
            { label: '导入中', value: 'running' },
            { label: '取消中', value: 'canceling' },
            { label: '已取消', value: 'canceled' },
            { label: '已完成', value: 'completed' },
            { label: '失败', value: 'failed' },
          ]"
          @change="load(1)"
        />
        <a-button :icon="h(ReloadOutlined)" @click="load()">刷新</a-button>
        <span class="neye-empty-text"
          >当前租户：{{ selectedTenant?.name || '-' }}</span
        >
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
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tenant'">
            {{ record.tenant?.name || '-' }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-space direction="vertical" :size="2">
              <a-tag :color="taskStatusInfo(record.status).color">
                {{ taskStatusInfo(record.status).text }}
              </a-tag>
              <span class="neye-empty-text">{{
                taskPhaseText(record.phase)
              }}</span>
            </a-space>
          </template>
          <template v-else-if="column.key === 'progress'">
            <div class="neye-import-progress-inline">
              <a-progress
                :percent="progressPercent(record)"
                :status="progressStatus(record)"
                :show-info="false"
                size="small"
                class="neye-import-progress-bar"
              />
              <span>{{ taskProgressText(record) }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'result'">
            <a-space size="small">
              <span
                >成功 {{ record.successRows }} / 失败
                {{ record.failedRows }}</span
              >
              <a-tag v-if="record.rolledBackAt" color="default">已回滚</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                type="link"
                class="neye-link-button"
                :icon="h(FileSearchOutlined)"
                @click="openDetail(record)"
              >
                详情
              </a-button>
              <a-button
                v-if="record.status === 'failed'"
                type="link"
                class="neye-link-button"
                :icon="h(DownloadOutlined)"
                @click="downloadErrorReport(record)"
              >
                错误报告
              </a-button>
              <a-button
                v-if="canCancelImportTask(record)"
                type="link"
                class="neye-link-button"
                :icon="h(StopOutlined)"
                @click="cancelTask(record)"
              >
                取消
              </a-button>
              <a-button
                v-if="canRollbackImportTask(record)"
                danger
                type="link"
                class="neye-link-button"
                :loading="rollbackLoadingId === taskIdOf(record)"
                :icon="h(RollbackOutlined)"
                @click="rollbackTask(record)"
              >
                回滚
              </a-button>
              <a-button
                v-if="canDeleteImportTask(record)"
                danger
                type="link"
                class="neye-link-button"
                :icon="h(DeleteOutlined)"
                @click="removeTask(record)"
              >
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <ImportTaskDetailModal
      v-model:open="detailOpen"
      :error-logs="errorLogs"
      :loading="detailLoading"
      :rollback-loading="
        Boolean(currentTask && rollbackLoadingId === taskIdOf(currentTask))
      "
      :rollback-summary="rollbackSummary"
      :task="currentTask"
      @download-error-report="downloadErrorReport"
      @refresh="loadDetail()"
      @rollback="rollbackTask"
    />

    <ImportTaskDangerModal
      v-model:open="dangerOpen"
      :action="dangerAction"
      :loading="dangerLoading"
      @confirm="submitDangerAction"
    />
  </div>
</template>

<style src="../../neye.css"></style>
