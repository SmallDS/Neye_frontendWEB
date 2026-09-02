<script setup lang="ts">
import type { ImportTask } from '#/types/neye';

import { h } from 'vue';

import {
  DownloadOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons-vue';

import { formatDate } from '#/utils/neye-format';

import {
  canRollbackImportTask,
  progressPercent,
  progressStatus,
  taskPhaseText,
  taskProgressText,
  taskStatusInfo,
} from '../view';

defineProps<{
  errorLogs: string[];
  loading: boolean;
  open: boolean;
  rollbackLoading: boolean;
  rollbackSummary: string;
  task: ImportTask | null;
}>();

const emit = defineEmits<{
  downloadErrorReport: [task: ImportTask];
  refresh: [];
  rollback: [task: ImportTask];
  'update:open': [open: boolean];
}>();
</script>

<template>
  <a-modal
    :open="open"
    title="导入任务详情"
    width="860px"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <a-spin :spinning="loading">
      <template v-if="task">
        <div class="neye-section-head">
          <h3 class="neye-section-title">导入进度</h3>
          <a-space>
            <a-button :icon="h(ReloadOutlined)" @click="emit('refresh')">
              刷新
            </a-button>
            <a-button
              v-if="task.status === 'failed'"
              :icon="h(DownloadOutlined)"
              @click="emit('downloadErrorReport', task)"
            >
              下载错误报告
            </a-button>
            <a-button
              v-if="canRollbackImportTask(task)"
              danger
              :loading="rollbackLoading"
              :icon="h(RollbackOutlined)"
              @click="emit('rollback', task)"
            >
              回滚
            </a-button>
          </a-space>
        </div>

        <div class="neye-import-progress-panel">
          <div class="neye-import-progress-head">
            <a-space>
              <a-tag :color="taskStatusInfo(task.status).color">
                {{ taskStatusInfo(task.status).text }}
              </a-tag>
              <a-tag>{{ taskPhaseText(task.phase) }}</a-tag>
            </a-space>
            <strong>{{ taskProgressText(task) }}</strong>
          </div>
          <a-progress
            :percent="progressPercent(task)"
            :status="progressStatus(task)"
          />
        </div>

        <div class="neye-stat-row">
          <div class="neye-stat-box">
            <div class="neye-stat-label">总行数</div>
            <div class="neye-stat-value">{{ task.totalRows }}</div>
          </div>
          <div class="neye-stat-box">
            <div class="neye-stat-label">已处理</div>
            <div class="neye-stat-value">{{ task.processedRows }}</div>
          </div>
          <div class="neye-stat-box">
            <div class="neye-stat-label">成功</div>
            <div class="neye-stat-value">{{ task.successRows }}</div>
          </div>
          <div class="neye-stat-box">
            <div class="neye-stat-label">失败</div>
            <div class="neye-stat-value">{{ task.failedRows }}</div>
          </div>
        </div>

        <div class="neye-detail-grid" style="margin-bottom: 14px">
          <div>
            <span>文件名</span><strong>{{ task.fileName }}</strong>
          </div>
          <div>
            <span>租户</span><strong>{{ task.tenant?.name || '-' }}</strong>
          </div>
          <div>
            <span>创建人</span>
            <strong>
              {{
                task.createdBy?.displayName || task.createdBy?.username || '-'
              }}
            </strong>
          </div>
          <div>
            <span>创建时间</span
            ><strong>{{ formatDate(task.createdAt) }}</strong>
          </div>
        </div>

        <a-alert
          v-if="task.rolledBackAt"
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
</template>
