<script setup lang="ts">
defineOptions({ name: 'NEyeImportTasks' });

import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue';

import { Modal, message } from 'ant-design-vue';
import {
  DeleteOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  RollbackOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';

import { apiBlob, apiRequest } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';
import type { ImportTask, ImportTaskStatus, PageResult } from '#/types/neye';
import { formatDate } from '#/utils/neye-format';

type ProgressStatus = 'active' | 'exception' | 'normal' | 'success';

type TaskRecord = ImportTask & { key?: string };

const loading = ref(false);
const uploading = ref(false);
const downloading = ref(false);
const detailOpen = ref(false);
const detailLoading = ref(false);
const rollbackLoadingId = ref<string>();
const currentTask = ref<ImportTask | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const result = ref<PageResult<ImportTask>>({ items: [], total: 0, page: 1, pageSize: 10 });
const query = ref({ page: 1, pageSize: 10 });
let refreshTimer: number | undefined;

const {
  isTenantReady,
  loadTenants,
  selectedTenant,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
} = useNeyeTenantScope();

const activeStatuses = new Set<ImportTaskStatus>(['pending', 'running', 'canceling']);
const terminalStatuses = new Set<ImportTaskStatus>(['canceled', 'completed', 'failed']);
const canAutoRefresh = computed(() => result.value.items.some((item) => activeStatuses.has(item.status)) || (currentTask.value ? activeStatuses.has(currentTask.value.status) : false));

const errorLogs = computed(() => {
  const task = currentTask.value;
  if (!task) return [];
  const lines: string[] = [];
  if (task.errorMessage) lines.push(`[任务] ${task.errorMessage}`);
  for (const row of task.rows || []) {
    if (row.status !== 'failed' && row.status !== 'skipped') continue;
    const customerNo = row.importCustomerNo ? ` / 客户 ${row.importCustomerNo}` : '';
    lines.push(`第 ${row.rowNo} 行${customerNo}：${row.errorMessage || rowStatusText(row.status)}`);
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

function rowStatusText(status: string) {
  if (status === 'failed') return '失败';
  if (status === 'skipped') return '已跳过';
  return status;
}

function progressPercent(task: ImportTask) {
  if (!task.totalRows) return 0;
  return Math.min(100, Math.round((task.processedRows / task.totalRows) * 100));
}

function progressStatus(task: ImportTask): ProgressStatus {
  if (task.status === 'failed' || task.failedRows > 0) return 'exception';
  if (task.status === 'running') return 'active';
  if (task.status === 'completed') return 'success';
  return 'normal';
}

function canCancel(task: ImportTask) {
  return task.status === 'pending' || task.status === 'running';
}

function canDelete(task: ImportTask) {
  return !activeStatuses.has(task.status);
}

function canRollback(task: ImportTask) {
  return terminalStatuses.has(task.status) && !task.rolledBackAt && task.successRows > 0;
}

function taskIdOf(task: TaskRecord) {
  return task.id || task.key;
}

async function load(page = query.value.page) {
  loading.value = true;
  query.value.page = page;
  try {
    await loadTenants();
    if (!isTenantReady.value || !selectedTenantId.value) {
      result.value = { items: [], total: 0, page: query.value.page, pageSize: query.value.pageSize };
      return;
    }
    const params = new URLSearchParams({
      page: String(query.value.page),
      pageSize: String(query.value.pageSize),
      tenantId: selectedTenantId.value,
    });
    result.value = await apiRequest<PageResult<ImportTask>>(`/import-tasks?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入任务加载失败');
  } finally {
    loading.value = false;
  }
}

function tenantFilterOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '').toLowerCase().includes(input.toLowerCase());
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
  await uploadFile(file);
}

async function uploadFile(file: File) {
  if (!selectedTenantId.value) {
    message.warning('请先选择租户');
    return;
  }
  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('tenantId', selectedTenantId.value);
    formData.append('file', file);
    const task = await apiRequest<ImportTask>('/import-tasks/customer-optometry', { method: 'POST', body: formData });
    message.success('导入任务已创建');
    await load(1);
    await openDetail(task.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '上传失败');
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

async function loadDetail(id = currentTask.value ? taskIdOf(currentTask.value) : undefined) {
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

function cancelTask(task: ImportTask) {
  const id = taskIdOf(task);
  if (!id) {
    message.error('任务ID缺失');
    return;
  }
  Modal.confirm({
    title: '取消导入任务',
    content: `确认取消 ${task.fileName}？已成功导入的数据会保留，任务结束后可执行回滚。`,
    okText: '取消任务',
    cancelText: '返回',
    async onOk() {
      await apiRequest(`/import-tasks/${task.id}/cancel`, { method: 'POST' });
      message.success('已提交取消请求');
      await load();
      if (currentTask.value && taskIdOf(currentTask.value) === id) await loadDetail(id);
    },
  });
}

function rollbackTask(task: ImportTask) {
  const id = taskIdOf(task);
  if (!id) {
    message.error('任务ID缺失');
    return;
  }
  Modal.confirm({
    title: '回滚导入数据',
    content: `确认回滚 ${task.fileName}？会删除本次导入创建的客户、验光单，以及这些验光单下的配镜单。商品字典不会回滚。`,
    okText: '回滚',
    okType: 'danger',
    cancelText: '返回',
    async onOk() {
      rollbackLoadingId.value = id;
      try {
        const rolledBack = await apiRequest<ImportTask>(`/import-tasks/${task.id}/rollback`, { method: 'POST' });
        message.success(`已回滚：客户 ${rolledBack.rollbackCustomers || 0}，验光单 ${rolledBack.rollbackOptometryOrders || 0}`);
        await load();
        if (currentTask.value && taskIdOf(currentTask.value) === id) currentTask.value = rolledBack;
      } catch (error) {
        message.error(error instanceof Error ? error.message : '回滚失败');
        throw error;
      } finally {
        rollbackLoadingId.value = undefined;
      }
    },
  });
}

function removeTask(task: ImportTask) {
  const id = taskIdOf(task);
  if (!id) {
    message.error('任务ID缺失');
    return;
  }
  Modal.confirm({
    title: '删除导入任务',
    content: `确认删除 ${task.fileName} 的任务记录？这只删除任务记录，不会删除已导入的客户和验光单；需要删除导入数据请先回滚。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '返回',
    async onOk() {
      await apiRequest(`/import-tasks/${task.id}`, { method: 'DELETE' });
      message.success('导入任务已删除');
      if (currentTask.value && taskIdOf(currentTask.value) === id) detailOpen.value = false;
      await load(1);
    },
  });
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}

onMounted(async () => {
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
        <a-button :loading="downloading" :icon="h(DownloadOutlined)" @click="downloadTemplate">下载模板</a-button>
        <a-button type="primary" :disabled="!selectedTenantId" :loading="uploading" :icon="h(UploadOutlined)" @click="chooseFile">上传导入</a-button>
        <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display: none" @change="onFileChange" />
      </a-space>
    </div>

    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-select v-model:value="selectedTenantId" show-search :filter-option="tenantFilterOption" :loading="tenantLoading" :options="tenantOptions" placeholder="选择租户" class="neye-tenant-select" @change="load(1)" />
        <a-button :icon="h(ReloadOutlined)" @click="load()">刷新</a-button>
        <span class="neye-empty-text">当前租户：{{ selectedTenant?.name || '-' }}</span>
      </div>
      <a-table row-key="id" :columns="columns" :data-source="result.items" :loading="loading" :pagination="{ current: query.page, pageSize: query.pageSize, total: result.total, showSizeChanger: false }" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'tenant'">{{ record.tenant?.name || '-' }}</template>
          <template v-else-if="column.key === 'status'"><a-tag :color="taskStatusInfo(record.status).color">{{ taskStatusInfo(record.status).text }}</a-tag></template>
          <template v-else-if="column.key === 'progress'">
            <div class="neye-import-progress-inline">
              <a-progress :percent="progressPercent(record)" :status="progressStatus(record)" :show-info="false" size="small" class="neye-import-progress-bar" />
              <span>{{ record.processedRows }}/{{ record.totalRows }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'result'">
            <a-space size="small">
              <span>成功 {{ record.successRows }} / 失败 {{ record.failedRows }}</span>
              <a-tag v-if="record.rolledBackAt" color="default">已回滚</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button type="link" class="neye-link-button" :icon="h(FileSearchOutlined)" @click="openDetail(record)">详情</a-button>
              <a-button v-if="canCancel(record)" type="link" class="neye-link-button" :icon="h(StopOutlined)" @click="cancelTask(record)">取消</a-button>
              <a-button v-if="canRollback(record)" danger type="link" class="neye-link-button" :loading="rollbackLoadingId === taskIdOf(record)" :icon="h(RollbackOutlined)" @click="rollbackTask(record)">回滚</a-button>
              <a-button v-if="canDelete(record)" danger type="link" class="neye-link-button" :icon="h(DeleteOutlined)" @click="removeTask(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal v-model:open="detailOpen" title="导入任务详情" width="860px" :footer="null" destroy-on-close>
      <a-spin :spinning="detailLoading">
        <template v-if="currentTask">
          <div class="neye-section-head">
            <h3 class="neye-section-title">导入进度</h3>
            <a-space>
              <a-button :icon="h(ReloadOutlined)" @click="loadDetail()">刷新</a-button>
              <a-button v-if="canRollback(currentTask)" danger :loading="rollbackLoadingId === taskIdOf(currentTask)" :icon="h(RollbackOutlined)" @click="rollbackTask(currentTask)">回滚</a-button>
            </a-space>
          </div>
          <div class="neye-import-progress-panel">
            <div class="neye-import-progress-head">
              <a-tag :color="taskStatusInfo(currentTask.status).color">{{ taskStatusInfo(currentTask.status).text }}</a-tag>
              <strong>{{ currentTask.processedRows }}/{{ currentTask.totalRows }}</strong>
            </div>
            <a-progress :percent="progressPercent(currentTask)" :status="progressStatus(currentTask)" />
          </div>

          <div class="neye-stat-row">
            <div class="neye-stat-box"><div class="neye-stat-label">总行数</div><div class="neye-stat-value">{{ currentTask.totalRows }}</div></div>
            <div class="neye-stat-box"><div class="neye-stat-label">已处理</div><div class="neye-stat-value">{{ currentTask.processedRows }}</div></div>
            <div class="neye-stat-box"><div class="neye-stat-label">成功</div><div class="neye-stat-value">{{ currentTask.successRows }}</div></div>
            <div class="neye-stat-box"><div class="neye-stat-label">失败</div><div class="neye-stat-value">{{ currentTask.failedRows }}</div></div>
          </div>

          <div class="neye-detail-grid" style="margin-bottom: 14px">
            <div><span>文件名</span><strong>{{ currentTask.fileName }}</strong></div>
            <div><span>租户</span><strong>{{ currentTask.tenant?.name || '-' }}</strong></div>
            <div><span>创建人</span><strong>{{ currentTask.createdBy?.displayName || currentTask.createdBy?.username || '-' }}</strong></div>
            <div><span>创建时间</span><strong>{{ formatDate(currentTask.createdAt) }}</strong></div>
          </div>

          <a-alert v-if="currentTask.rolledBackAt" type="warning" show-icon style="margin-bottom: 12px" :message="rollbackSummary" />

          <h3 class="neye-section-title">错误日志</h3>
          <div class="neye-import-log">
            <template v-if="errorLogs.length">
              <div v-for="(line, index) in errorLogs" :key="index">{{ line }}</div>
            </template>
            <span v-else class="neye-empty-text">暂无错误日志</span>
          </div>
        </template>
      </a-spin>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>