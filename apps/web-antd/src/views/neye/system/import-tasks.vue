<script setup lang="ts">
import type {
  ImportCapabilities,
  ImportTask,
  ImportTaskPhase,
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
  importDangerDescription,
  isSupportedImportFile,
  validateDangerConfirmation,
} from './governance';

defineOptions({ name: 'NEyeImportTasks' });

type ProgressStatus = 'active' | 'exception' | 'normal' | 'success';

type TaskRecord = ImportTask & { key?: string };

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
const dangerForm = ref({ confirmation: '' });
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

const {
  isTenantReady,
  loadTenants,
  selectedTenant,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
} = useNeyeTenantScope();

const activeStatuses = new Set<ImportTaskStatus>([
  'canceling',
  'pending',
  'running',
]);
const terminalStatuses = new Set<ImportTaskStatus>([
  'canceled',
  'completed',
  'failed',
]);
const canAutoRefresh = computed(
  () =>
    result.value.items.some((item) => activeStatuses.has(item.status)) ||
    (currentTask.value ? activeStatuses.has(currentTask.value.status) : false),
);

const errorLogs = computed(() => {
  const task = currentTask.value;
  if (!task) return [];
  const lines: string[] = [];
  if (task.errorMessage) lines.push(`[任务] ${task.errorMessage}`);
  for (const row of task.rows || []) {
    if (row.status !== 'failed' && row.status !== 'skipped') continue;
    const customerNo = row.importCustomerNo
      ? ` / 客户 ${row.importCustomerNo}`
      : '';
    lines.push(
      `第 ${row.rowNo} 行${customerNo}：${row.errorMessage || rowStatusText(row.status)}`,
    );
  }
  return lines;
});

const rollbackSummary = computed(() => {
  const task = currentTask.value;
  if (!task?.rolledBackAt) return '';
  return `已回滚：客户 ${task.rollbackCustomers || 0}，验光单 ${task.rollbackOptometryOrders || 0}，配镜单 ${task.rollbackFittingOrders || 0}`;
});

const columns = [
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
  { title: '租户', dataIndex: 'tenant', key: 'tenant', width: 180 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '进度', key: 'progress', width: 190 },
  { title: '结果', key: 'result', width: 190 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
  { title: '操作', key: 'action', width: 280 },
];

function taskStatusInfo(status: ImportTaskStatus) {
  const map: Record<ImportTaskStatus, { color: string; text: string }> = {
    pending: { color: 'blue', text: '等待中' },
    running: { color: 'processing', text: '导入中' },
    canceling: { color: 'orange', text: '取消中' },
    canceled: { color: 'default', text: '已取消' },
    completed: { color: 'green', text: '已完成' },
    failed: { color: 'red', text: '失败' },
  };
  return map[status];
}

function taskPhaseText(phase: ImportTaskPhase) {
  const map: Record<ImportTaskPhase, string> = {
    cleanup: '清理中',
    finished: '已结束',
    parsing: '解析并暂存',
    processing: '分批处理',
    publishing: '原子发布',
    uploaded: '等待解析',
  };
  return map[phase];
}

function taskProgressText(task: ImportTask) {
  if (task.phase === 'parsing')
    return `已暂存 ${task.stagedRows}/${task.totalRows || '?'}`;
  if (task.phase === 'publishing') return '正在原子发布，请勿关闭服务';
  if (task.phase === 'cleanup') return '正在清理未发布数据';
  return `${task.processedRows}/${task.totalRows}`;
}
function rowStatusText(status: string) {
  if (status === 'failed') return '失败';
  if (status === 'skipped') return '已跳过';
  return status;
}

function progressPercent(task: ImportTask) {
  if (task.status === 'completed') return 100;
  if (!task.totalRows) return 0;
  const completed =
    task.phase === 'parsing' ? task.stagedRows : task.processedRows;
  const percent = Math.round((completed / task.totalRows) * 100);
  return task.phase === 'publishing' ? 99 : Math.min(100, percent);
}

function progressStatus(task: ImportTask): ProgressStatus {
  if (task.status === 'failed' || task.failedRows > 0) return 'exception';
  if (task.status === 'running') return 'active';
  if (task.status === 'completed') return 'success';
  return 'normal';
}

function canCancel(task: ImportTask) {
  return (
    (task.status === 'pending' || task.status === 'running') &&
    task.phase !== 'publishing'
  );
}

function canDelete(task: ImportTask) {
  return !activeStatuses.has(task.status);
}

function canRollback(task: ImportTask) {
  return (
    terminalStatuses.has(task.status) &&
    !task.rolledBackAt &&
    task.successRows > 0
  );
}

function taskIdOf(task: TaskRecord) {
  return task.id || task.key;
}

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
  loading.value = true;
  query.value.page = page;
  try {
    await loadTenants();
    if (!isTenantReady.value || !selectedTenantId.value) {
      result.value = {
        items: [],
        total: 0,
        page: query.value.page,
        pageSize: query.value.pageSize,
      };
      return;
    }
    const params = new URLSearchParams({
      page: String(query.value.page),
      pageSize: String(query.value.pageSize),
      tenantId: selectedTenantId.value,
    });
    if (query.value.status) params.set('status', query.value.status);
    result.value = await apiRequest<PageResult<ImportTask>>(
      `/import-tasks?${params}`,
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入任务加载失败');
  } finally {
    loading.value = false;
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
    formData.append('tenantId', selectedTenantId.value);
    formData.append('file', pending.file);
    formData.append('idempotencyKey', pending.idempotencyKey);
    const task = await importTasksApi.createCustomerOptometry(formData);
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
    const blob = await importTasksApi.getErrorReport(task.id);
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
  detailLoading.value = true;
  try {
    currentTask.value = await apiRequest<ImportTask>(`/import-tasks/${id}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '任务详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

function openDanger(task: ImportTask, kind: ImportDangerKind) {
  const titles: Record<ImportDangerKind, string> = {
    cancel: '取消导入任务',
    delete: '删除导入任务',
    rollback: '回滚导入数据',
  };
  dangerAction.value = { kind, task, title: titles[kind] };
  dangerForm.value = { confirmation: '' };
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

async function submitDangerAction() {
  const action = dangerAction.value;
  if (!action) return;
  const id = taskIdOf(action.task);
  if (!id) {
    message.error('任务 ID 缺失');
    return;
  }
  const validation = validateDangerConfirmation(
    dangerForm.value.confirmation,
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

onMounted(async () => {
  await loadCapabilities();
  await load();
  refreshTimer = window.setInterval(() => {
    if (!canAutoRefresh.value) return;
    void load();
    if (currentTask.value && activeStatuses.has(currentTask.value.status)) {
      void loadDetail(currentTask.value.id);
    }
  }, 2500);
});

onBeforeUnmount(() => {
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
          >下载模板</a-button
        >
        <a-button
          v-if="pendingUpload && uploadError"
          :loading="uploading"
          :icon="h(ReloadOutlined)"
          @click="uploadPendingFile"
          >重试上传</a-button
        >
        <a-button
          type="primary"
          :disabled="!selectedTenantId"
          :loading="uploading"
          :icon="h(UploadOutlined)"
          @click="chooseFile"
          >选择并上传</a-button
        >
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
          <template v-if="column.key === 'tenant'">{{
            record.tenant?.name || '-'
          }}</template>
          <template v-else-if="column.key === 'status'">
            <a-space direction="vertical" :size="2">
              <a-tag :color="taskStatusInfo(record.status).color">{{
                taskStatusInfo(record.status).text
              }}</a-tag>
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
          <template v-else-if="column.key === 'createdAt'">{{
            formatDate(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                type="link"
                class="neye-link-button"
                :icon="h(FileSearchOutlined)"
                @click="openDetail(record)"
                >详情</a-button
              >
              <a-button
                v-if="record.status === 'failed'"
                type="link"
                class="neye-link-button"
                :icon="h(DownloadOutlined)"
                @click="downloadErrorReport(record)"
                >错误报告</a-button
              >
              <a-button
                v-if="canCancel(record)"
                type="link"
                class="neye-link-button"
                :icon="h(StopOutlined)"
                @click="cancelTask(record)"
                >取消</a-button
              >
              <a-button
                v-if="canRollback(record)"
                danger
                type="link"
                class="neye-link-button"
                :loading="rollbackLoadingId === taskIdOf(record)"
                :icon="h(RollbackOutlined)"
                @click="rollbackTask(record)"
                >回滚</a-button
              >
              <a-button
                v-if="canDelete(record)"
                danger
                type="link"
                class="neye-link-button"
                :icon="h(DeleteOutlined)"
                @click="removeTask(record)"
                >删除</a-button
              >
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="detailOpen"
      title="导入任务详情"
      width="860px"
      :footer="null"
      destroy-on-close
    >
      <a-spin :spinning="detailLoading">
        <template v-if="currentTask">
          <div class="neye-section-head">
            <h3 class="neye-section-title">导入进度</h3>
            <a-space>
              <a-button :icon="h(ReloadOutlined)" @click="loadDetail()"
                >刷新</a-button
              >
              <a-button
                v-if="currentTask.status === 'failed'"
                :icon="h(DownloadOutlined)"
                @click="downloadErrorReport(currentTask)"
                >下载错误报告</a-button
              >
              <a-button
                v-if="canRollback(currentTask)"
                danger
                :loading="rollbackLoadingId === taskIdOf(currentTask)"
                :icon="h(RollbackOutlined)"
                @click="rollbackTask(currentTask)"
                >回滚</a-button
              >
            </a-space>
          </div>
          <div class="neye-import-progress-panel">
            <div class="neye-import-progress-head">
              <a-space>
                <a-tag :color="taskStatusInfo(currentTask.status).color">{{
                  taskStatusInfo(currentTask.status).text
                }}</a-tag>
                <a-tag>{{ taskPhaseText(currentTask.phase) }}</a-tag>
              </a-space>
              <strong>{{ taskProgressText(currentTask) }}</strong>
            </div>
            <a-progress
              :percent="progressPercent(currentTask)"
              :status="progressStatus(currentTask)"
            />
          </div>

          <div class="neye-stat-row">
            <div class="neye-stat-box">
              <div class="neye-stat-label">总行数</div>
              <div class="neye-stat-value">{{ currentTask.totalRows }}</div>
            </div>
            <div class="neye-stat-box">
              <div class="neye-stat-label">已处理</div>
              <div class="neye-stat-value">{{ currentTask.processedRows }}</div>
            </div>
            <div class="neye-stat-box">
              <div class="neye-stat-label">成功</div>
              <div class="neye-stat-value">{{ currentTask.successRows }}</div>
            </div>
            <div class="neye-stat-box">
              <div class="neye-stat-label">失败</div>
              <div class="neye-stat-value">{{ currentTask.failedRows }}</div>
            </div>
          </div>

          <div class="neye-detail-grid" style="margin-bottom: 14px">
            <div>
              <span>文件名</span><strong>{{ currentTask.fileName }}</strong>
            </div>
            <div>
              <span>租户</span
              ><strong>{{ currentTask.tenant?.name || '-' }}</strong>
            </div>
            <div>
              <span>创建人</span
              ><strong>{{
                currentTask.createdBy?.displayName ||
                currentTask.createdBy?.username ||
                '-'
              }}</strong>
            </div>
            <div>
              <span>创建时间</span
              ><strong>{{ formatDate(currentTask.createdAt) }}</strong>
            </div>
          </div>

          <a-alert
            v-if="currentTask.rolledBackAt"
            type="warning"
            show-icon
            style="margin-bottom: 12px"
            :message="rollbackSummary"
          />

          <h3 class="neye-section-title">错误日志</h3>
          <div class="neye-import-log">
            <template v-if="errorLogs.length">
              <div v-for="(line, index) in errorLogs" :key="index">
                {{ line }}
              </div>
            </template>
            <span v-else class="neye-empty-text">暂无错误日志</span>
          </div>
        </template>
      </a-spin>
    </a-modal>

    <a-modal
      v-model:open="dangerOpen"
      :title="dangerAction?.title"
      :footer="null"
      destroy-on-close
    >
      <a-alert
        type="warning"
        show-icon
        :message="dangerAction?.title"
        :description="importDangerDescription(dangerAction?.kind)"
        style="margin-bottom: 16px"
      />
      <a-form
        layout="vertical"
        :model="dangerForm"
        @finish="submitDangerAction"
      >
        <a-form-item
          :label="`请输入文件名“${dangerAction?.task.fileName || ''}”完成确认`"
          name="confirmation"
          :rules="[{ required: true, message: '请输入文件名' }]"
        >
          <a-input v-model:value="dangerForm.confirmation" autocomplete="off" />
        </a-form-item>
        <a-space>
          <a-button
            :danger="dangerAction?.kind !== 'cancel'"
            type="primary"
            html-type="submit"
            :loading="dangerLoading"
            >确认执行</a-button
          >
          <a-button @click="dangerOpen = false">返回</a-button>
        </a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
