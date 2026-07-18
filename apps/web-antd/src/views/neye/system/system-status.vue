<script setup lang="ts">
import type { AdminSystemStatus, SystemHealthStatus } from '#/types/neye';

import { computed, h, onBeforeUnmount, onMounted, ref } from 'vue';

import { ReloadOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

import { adminApi } from '#/api/neye';
import { formatDate } from '#/utils/neye-format';

defineOptions({ name: 'NEyeSystemStatus' });

const loading = ref(false);
const autoRefresh = ref(true);
const status = ref<AdminSystemStatus>();
let timer: number | undefined;

const memoryPercent = computed(() => {
  const memory = status.value?.memory;
  if (!memory?.heapTotalBytes) return 0;
  return Math.round((memory.heapUsedBytes / memory.heapTotalBytes) * 100);
});

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    status.value = await adminApi.getSystemStatus();
  } catch (error) {
    if (!silent)
      message.error(
        error instanceof Error ? error.message : '系统状态加载失败',
      );
  } finally {
    loading.value = false;
  }
}

function statusInfo(value?: SystemHealthStatus) {
  const map = {
    error: { color: 'red', text: '异常' },
    ok: { color: 'green', text: '正常' },
    warning: { color: 'orange', text: '警告' },
  } as const;
  return value ? map[value] : { color: 'default', text: '未知' };
}

function bytes(value = 0) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function duration(seconds = 0) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days} 天 ${hours} 小时 ${minutes} 分`;
}

onMounted(async () => {
  await load();
  timer = window.setInterval(() => {
    if (autoRefresh.value) void load(true);
  }, 30_000);
});

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">系统状态</h1>
        <p class="neye-page-subtitle">查看 API、数据库、运行时与内存健康状态</p>
      </div>
      <a-space>
        <a-switch
          v-model:checked="autoRefresh"
          checked-children="自动刷新"
          un-checked-children="手动刷新"
        />
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="load()"
          >刷新</a-button
        >
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <a-alert
        :type="
          status?.status === 'ok'
            ? 'success'
            : status?.status === 'warning'
              ? 'warning'
              : 'error'
        "
        show-icon
        :message="`整体状态：${statusInfo(status?.status).text}`"
        :description="`最近检查：${status?.checkedAt ? formatDate(status.checkedAt) : '-'}`"
        style="margin-bottom: 16px"
      />

      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :md="8"
          ><a-card
            ><a-statistic
              title="运行时长"
              :value="duration(status?.uptimeSeconds)" /></a-card
        ></a-col>
        <a-col :xs="24" :md="8"
          ><a-card
            ><a-statistic
              title="常驻内存"
              :value="bytes(status?.memory.rssBytes)" /></a-card
        ></a-col>
        <a-col :xs="24" :md="8"
          ><a-card
            ><a-statistic
              title="堆内存使用"
              :value="`${memoryPercent}%`" /><a-progress
              :percent="memoryPercent"
              :status="memoryPercent >= 90 ? 'exception' : 'normal'"
              :show-info="false" /></a-card
        ></a-col>
      </a-row>

      <section class="neye-panel" style="margin-top: 16px">
        <div class="neye-section-head">
          <h3 class="neye-section-title">健康检查项</h3>
        </div>
        <a-list :data-source="status?.checks || []" bordered>
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta
                :title="item.name"
                :description="item.message || '-'"
              />
              <a-space>
                <span v-if="item.latencyMs !== undefined" class="neye-muted"
                  >{{ item.latencyMs }} ms</span
                >
                <a-tag :color="statusInfo(item.status).color">{{
                  statusInfo(item.status).text
                }}</a-tag>
              </a-space>
            </a-list-item>
          </template>
        </a-list>
      </section>

      <section class="neye-panel" style="margin-top: 16px">
        <div class="neye-section-head">
          <h3 class="neye-section-title">运行时信息</h3>
        </div>
        <a-descriptions bordered :column="2" size="small">
          <a-descriptions-item label="Node.js">{{
            status?.runtime.nodeVersion || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="平台">{{
            status?.runtime.platform || '-'
          }}</a-descriptions-item>
          <a-descriptions-item label="堆内存"
            >{{ bytes(status?.memory.heapUsedBytes) }} /
            {{ bytes(status?.memory.heapTotalBytes) }}</a-descriptions-item
          >
          <a-descriptions-item label="常驻内存">{{
            bytes(status?.memory.rssBytes)
          }}</a-descriptions-item>
        </a-descriptions>
      </section>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>
