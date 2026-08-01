<script setup lang="ts">
import type {
  EventLog,
  EventLogClearPreview,
  EventLogClearScope,
  EventLogQuery,
  PageResult,
} from '#/types/neye';
import type { Dayjs } from 'dayjs';

import { h, onMounted, reactive, ref } from 'vue';

import {
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import '../neye.css';

import { adminApi } from '#/api/neye';

import {
  eventLogActionText,
  eventLogCategoryText,
  eventLogLevelInfo,
  eventLogModuleOptions,
  eventLogModuleText,
  eventLogReasonText,
  eventLogResourceTypeText,
  eventLogResultInfo,
  eventLogSystemMessageText,
  formatEventLogMetadata,
  validateEventLogClear,
} from './event-logs';

defineOptions({ name: 'NEyeEventLogs' });

const loading = ref(false);
const detailLoading = ref(false);
const detailOpen = ref(false);
const detail = ref<EventLog>();
const retentionOpen = ref(false);
const retentionLoading = ref(false);
const retentionSaving = ref(false);
const retentionDays = ref(180);
const clearOpen = ref(false);
const previewLoading = ref(false);
const clearLoading = ref(false);
const clearScope = ref<EventLogClearScope>('beforeDate');
const clearBeforeDate = ref<Dayjs>();
const clearPreview = ref<EventLogClearPreview>();
const clearConfirmation = ref('');
const clearReason = ref('');
const dateRange = ref<[Dayjs, Dayjs]>();

const query = reactive<EventLogQuery>({ page: 1, pageSize: 20 });
const result = ref<PageResult<EventLog>>({
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
});

const columns = [
  { dataIndex: 'createdAt', key: 'createdAt', title: '时间', width: 180 },
  { dataIndex: 'level', key: 'level', title: '等级', width: 90 },
  { dataIndex: 'category', key: 'category', title: '分类', width: 90 },
  { dataIndex: 'result', key: 'result', title: '结果', width: 90 },
  { dataIndex: 'module', key: 'module', title: '模块', width: 130 },
  { dataIndex: 'action', key: 'action', title: '事件', width: 180 },
  {
    dataIndex: 'actorUsername',
    key: 'actorUsername',
    title: '操作人',
    width: 130,
  },
  { dataIndex: 'tenantId', key: 'tenantId', title: '店铺 ID', width: 190 },
  { dataIndex: 'requestId', key: 'requestId', title: '请求 ID', width: 220 },
  { key: 'actionColumn', fixed: 'right', title: '操作', width: 80 },
];

function formatDateTime(value?: null | string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-';
}

function buildQuery(page: number): EventLogQuery {
  return {
    ...query,
    page,
    endAt: dateRange.value?.[1].endOf('day').toISOString(),
    startAt: dateRange.value?.[0].startOf('day').toISOString(),
  };
}

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  try {
    result.value = await adminApi.getEventLogs(buildQuery(page));
  } catch (error) {
    message.error(error instanceof Error ? error.message : '日志加载失败');
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  Object.assign(query, {
    actorUsername: undefined,
    category: undefined,
    level: undefined,
    module: undefined,
    requestId: undefined,
    resourceId: undefined,
    result: undefined,
    tenantId: undefined,
  });
  dateRange.value = undefined;
  void load(1);
}

async function openDetail(item: EventLog) {
  detailOpen.value = true;
  detailLoading.value = true;
  detail.value = item;
  try {
    detail.value = await adminApi.getEventLog(item.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '日志详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function loadRetention(showError = true) {
  retentionLoading.value = true;
  try {
    const value = await adminApi.getEventLogRetention();
    retentionDays.value = value.retentionDays;
  } catch (error) {
    if (showError) {
      message.error(
        error instanceof Error ? error.message : '保留期限加载失败',
      );
    }
  } finally {
    retentionLoading.value = false;
  }
}

async function openRetention() {
  retentionOpen.value = true;
  await loadRetention();
}

async function saveRetention() {
  retentionSaving.value = true;
  try {
    const value = await adminApi.updateEventLogRetention({
      retentionDays: retentionDays.value,
    });
    retentionDays.value = value.retentionDays;
    retentionOpen.value = false;
    message.success(
      value.deletedCount > 0
        ? `保留期限已更新，并清理 ${value.deletedCount} 条过期日志`
        : '保留期限已更新',
    );
    await load(1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保留期限更新失败');
  } finally {
    retentionSaving.value = false;
  }
}

function openClear() {
  clearScope.value = 'beforeDate';
  clearBeforeDate.value = dayjs().subtract(retentionDays.value, 'day');
  clearPreview.value = undefined;
  clearConfirmation.value = '';
  clearReason.value = '';
  clearOpen.value = true;
}

function resetClearPreview() {
  clearPreview.value = undefined;
  clearConfirmation.value = '';
}

function clearSelection() {
  if (clearScope.value === 'beforeDate') {
    return {
      beforeDate: clearBeforeDate.value?.format('YYYY-MM-DD'),
      scope: clearScope.value,
    } as const;
  }
  return { scope: clearScope.value } as const;
}

async function previewClear() {
  if (clearScope.value === 'beforeDate' && !clearBeforeDate.value) {
    message.warning('请选择截止日期');
    return;
  }
  previewLoading.value = true;
  try {
    clearPreview.value = await adminApi.previewEventLogClear(clearSelection());
    clearConfirmation.value = '';
  } catch (error) {
    message.error(error instanceof Error ? error.message : '清空预览失败');
  } finally {
    previewLoading.value = false;
  }
}

async function submitClear() {
  const preview = clearPreview.value;
  if (!preview) return;
  const validation = validateEventLogClear(
    clearConfirmation.value,
    preview.confirmationText,
    clearReason.value,
  );
  if (validation) {
    message.warning(validation);
    return;
  }

  clearLoading.value = true;
  try {
    const cleared = await adminApi.clearEventLogs({
      ...clearSelection(),
      confirmationText: clearConfirmation.value,
      expectedCount: preview.expectedCount,
      reason: clearReason.value.trim(),
    });
    clearOpen.value = false;
    message.success(`已清空 ${cleared.deletedCount} 条日志`);
    await load(1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '日志清空失败');
  } finally {
    clearLoading.value = false;
  }
}

function handleTableChange(pagination: {
  current?: number;
  pageSize?: number;
}) {
  query.pageSize = Number(pagination.pageSize || query.pageSize);
  void load(Number(pagination.current || 1));
}

onMounted(() => {
  void load(1);
  void loadRetention(false);
});
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">日志中心</h1>
        <p class="neye-page-subtitle">
          检索操作审计、安全事件和系统异常，并管理日志保留期限
        </p>
      </div>
      <a-space wrap>
        <a-button :icon="h(SettingOutlined)" @click="openRetention">
          保留期限
        </a-button>
        <a-button danger :icon="h(DeleteOutlined)" @click="openClear">
          清空日志
        </a-button>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="load()">
          刷新
        </a-button>
      </a-space>
    </div>

    <section class="neye-panel">
      <div class="event-log-filters">
        <a-select
          v-model:value="query.level"
          allow-clear
          placeholder="日志等级"
          :options="[
            { label: '信息', value: 'INFO' },
            { label: '警告', value: 'WARN' },
            { label: '错误', value: 'ERROR' },
          ]"
        />
        <a-select
          v-model:value="query.category"
          allow-clear
          placeholder="日志分类"
          :options="[
            { label: '审计', value: 'AUDIT' },
            { label: '安全', value: 'SECURITY' },
            { label: '系统', value: 'SYSTEM' },
          ]"
        />
        <a-select
          v-model:value="query.result"
          allow-clear
          placeholder="执行结果"
          :options="[
            { label: '成功', value: 'SUCCESS' },
            { label: '已拒绝', value: 'DENIED' },
            { label: '失败', value: 'FAILED' },
          ]"
        />
        <a-select
          v-model:value="query.module"
          allow-clear
          placeholder="模块"
          :options="eventLogModuleOptions"
        />
        <a-input
          v-model:value="query.actorUsername"
          allow-clear
          placeholder="操作人"
        />
        <a-input
          v-model:value="query.tenantId"
          allow-clear
          placeholder="店铺 ID"
        />
        <a-input
          v-model:value="query.requestId"
          allow-clear
          placeholder="请求 ID"
        />
        <a-input
          v-model:value="query.resourceId"
          allow-clear
          placeholder="资源 ID"
        />
        <a-range-picker
          v-model:value="dateRange"
          :placeholder="['开始日期', '结束日期']"
        />
        <a-space>
          <a-button type="primary" :icon="h(SearchOutlined)" @click="load(1)">
            查询
          </a-button>
          <a-button @click="resetFilters">重置</a-button>
        </a-space>
      </div>

      <a-table
        row-key="id"
        :columns="columns"
        :data-source="result.items"
        :loading="loading"
        :pagination="{
          current: result.page,
          pageSize: result.pageSize,
          total: result.total,
          showSizeChanger: true,
          showTotal: (total: number) => `共 ${total} 条`,
        }"
        :scroll="{ x: 1450 }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'level'">
            <a-tag :color="eventLogLevelInfo(record.level).color">
              {{ eventLogLevelInfo(record.level).text }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'category'">
            {{ eventLogCategoryText(record.category) }}
          </template>
          <template v-else-if="column.key === 'result'">
            <a-tag :color="eventLogResultInfo(record.result).color">
              {{ eventLogResultInfo(record.result).text }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'module'">
            {{ eventLogModuleText(record.module) }}
          </template>
          <template v-else-if="column.key === 'action'">
            {{ eventLogActionText(record.action) }}
          </template>
          <template v-else-if="column.key === 'actorUsername'">
            {{ record.actorUsername || '-' }}
          </template>
          <template v-else-if="column.key === 'tenantId'">
            <span class="event-log-mono">{{ record.tenantId || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'requestId'">
            <span class="event-log-mono">{{ record.requestId || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'actionColumn'">
            <a-button
              type="link"
              class="neye-link-button"
              :icon="h(EyeOutlined)"
              @click="openDetail(record)"
            >
              详情
            </a-button>
          </template>
        </template>
      </a-table>
    </section>

    <a-drawer
      v-model:open="detailOpen"
      title="日志详情"
      width="720"
      destroy-on-close
    >
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detail" bordered :column="1" size="small">
          <a-descriptions-item label="日志 ID">
            <span class="event-log-mono">{{ detail.id }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="发生时间">
            {{ formatDateTime(detail.createdAt) }}
          </a-descriptions-item>
          <a-descriptions-item label="等级 / 分类 / 结果">
            <a-space>
              <a-tag :color="eventLogLevelInfo(detail.level).color">
                {{ eventLogLevelInfo(detail.level).text }}
              </a-tag>
              <span>{{ eventLogCategoryText(detail.category) }}</span>
              <a-tag :color="eventLogResultInfo(detail.result).color">
                {{ eventLogResultInfo(detail.result).text }}
              </a-tag>
            </a-space>
          </a-descriptions-item>
          <a-descriptions-item label="模块 / 事件">
            {{ eventLogModuleText(detail.module) }} /
            {{ eventLogActionText(detail.action) }}
          </a-descriptions-item>
          <a-descriptions-item label="操作人">
            {{ detail.actorUsername || '-' }}
            <span v-if="detail.actorUserId" class="event-log-mono">
              （{{ detail.actorUserId }}）
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="店铺 ID">
            <span class="event-log-mono">{{ detail.tenantId || '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="资源">
            {{ eventLogResourceTypeText(detail.resourceType) }}
            <span v-if="detail.resourceId" class="event-log-mono">
              （{{ detail.resourceId }}）
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="请求 ID">
            <span class="event-log-mono">{{ detail.requestId || '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="IP 地址">
            <span class="event-log-mono">{{ detail.ipAddress || '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="原因">
            {{ eventLogReasonText(detail.action, detail.reason) }}
          </a-descriptions-item>
          <a-descriptions-item label="错误摘要">
            {{ eventLogSystemMessageText(detail.errorSummary) }}
          </a-descriptions-item>
          <a-descriptions-item label="附加信息">
            <pre class="event-log-metadata">{{
              formatEventLogMetadata(detail.metadata)
            }}</pre>
          </a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </a-drawer>

    <a-modal
      v-model:open="retentionOpen"
      title="日志保留期限"
      :confirm-loading="retentionSaving"
      :ok-button-props="{ disabled: retentionLoading }"
      ok-text="保存"
      cancel-text="取消"
      @ok="saveRetention"
    >
      <a-spin :spinning="retentionLoading">
        <a-alert
          type="info"
          show-icon
          message="更新后将立即清理超过保留期限的日志"
          style="margin-bottom: 16px"
        />
        <a-form layout="vertical">
          <a-form-item label="保留天数" required>
            <a-input-number
              v-model:value="retentionDays"
              :min="30"
              :max="730"
              :precision="0"
              style="width: 100%"
            />
          </a-form-item>
        </a-form>
      </a-spin>
    </a-modal>

    <a-modal
      v-model:open="clearOpen"
      title="清空日志"
      :footer="null"
      width="640px"
      destroy-on-close
    >
      <a-alert
        type="error"
        show-icon
        message="高风险操作：日志清空后不可恢复"
        style="margin-bottom: 16px"
      />
      <a-form layout="vertical">
        <a-form-item label="清空范围">
          <a-radio-group v-model:value="clearScope" @change="resetClearPreview">
            <a-radio value="beforeDate">清空指定日期前的日志</a-radio>
            <a-radio value="all">清空全部日志</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          v-if="clearScope === 'beforeDate'"
          label="截止日期"
          required
        >
          <a-date-picker
            v-model:value="clearBeforeDate"
            style="width: 100%"
            @change="resetClearPreview"
          />
        </a-form-item>
        <a-button
          v-if="!clearPreview"
          :loading="previewLoading"
          @click="previewClear"
        >
          预览清空范围
        </a-button>

        <template v-else>
          <a-alert
            :type="clearPreview.expectedCount > 0 ? 'warning' : 'info'"
            show-icon
            :message="`预计清空 ${clearPreview.expectedCount} 条日志`"
            :description="
              clearPreview.cutoff
                ? `截止时间：${formatDateTime(clearPreview.cutoff)}`
                : '范围：全部日志'
            "
            style="margin-bottom: 16px"
          />
          <a-form-item label="清空原因" required>
            <a-textarea
              v-model:value="clearReason"
              :maxlength="500"
              :rows="3"
              show-count
              placeholder="请说明本次清空原因（至少 5 个字符）"
            />
          </a-form-item>
          <a-form-item
            :label="`请输入“${clearPreview.confirmationText}”完成确认`"
            required
          >
            <a-input v-model:value="clearConfirmation" autocomplete="off" />
          </a-form-item>
          <a-space>
            <a-button
              danger
              type="primary"
              :disabled="clearPreview.expectedCount === 0"
              :loading="clearLoading"
              @click="submitClear"
            >
              确认清空
            </a-button>
            <a-button @click="resetClearPreview">重新预览</a-button>
            <a-button @click="clearOpen = false">取消</a-button>
          </a-space>
        </template>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.event-log-filters {
  display: grid;
  grid-template-columns: repeat(5, minmax(160px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.event-log-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.event-log-metadata {
  max-height: 320px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
@media (max-width: 1200px) {
  .event-log-filters {
    grid-template-columns: repeat(3, minmax(160px, 1fr));
  }
}
@media (max-width: 780px) {
  .event-log-filters {
    grid-template-columns: 1fr;
  }
}
</style>
