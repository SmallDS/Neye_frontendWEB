<script setup lang="ts">
import type { AdminOverview } from '#/types/neye';

import { computed, h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  CheckCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

import { adminApi } from '#/api/neye';

defineOptions({ name: 'NEyeAdminDashboard' });

const router = useRouter();
const loading = ref(false);
const overview = ref<AdminOverview>();
const tenantSummary = computed(() => overview.value?.counts.tenants);
const userSummary = computed(() => overview.value?.counts.users);

async function load() {
  loading.value = true;
  try {
    overview.value = await adminApi.getOverview();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '管理总览加载失败');
  } finally {
    loading.value = false;
  }
}

function percent(value = 0) {
  return `${Math.round(value * 100)}%`;
}

onMounted(load);
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">管理总览</h1>
        <p class="neye-page-subtitle">
          集中查看租户、账号、业务数据与导入任务运行情况
        </p>
      </div>
      <a-space>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="load"
          >刷新</a-button
        >
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :sm="12" :xl="6">
          <a-card
            ><a-statistic
              title="租户"
              :value="tenantSummary?.total || 0"
              :prefix="h(DatabaseOutlined)"
            />
            <div class="dashboard-note">
              启用 {{ tenantSummary?.active || 0 }} · 停用
              {{ tenantSummary?.disabled || 0 }}
            </div></a-card
          >
        </a-col>
        <a-col :xs="24" :sm="12" :xl="6">
          <a-card
            ><a-statistic
              title="账号"
              :value="userSummary?.total || 0"
              :prefix="h(TeamOutlined)"
            />
            <div class="dashboard-note">
              启用 {{ userSummary?.active || 0 }} · 停用
              {{ userSummary?.disabled || 0 }}
            </div></a-card
          >
        </a-col>
        <a-col :xs="24" :sm="12" :xl="6">
          <a-card
            ><a-statistic
              title="客户"
              :value="overview?.counts.customers || 0"
            />
            <div class="dashboard-note">
              近 {{ overview?.trends.periodDays || 30 }} 天新增
              {{ overview?.trends.customers || 0 }}
            </div></a-card
          >
        </a-col>
        <a-col :xs="24" :sm="12" :xl="6">
          <a-card
            ><a-statistic
              title="导入成功率"
              :value="percent(overview?.importTasks.successRate)"
              :prefix="h(CheckCircleOutlined)"
            />
            <div class="dashboard-note">
              运行 {{ overview?.importTasks.running || 0 }} · 失败
              {{ overview?.importTasks.failed || 0 }}
            </div></a-card
          >
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]" style="margin-top: 16px">
        <a-col :xs="24" :lg="12">
          <section class="neye-panel dashboard-panel">
            <div class="neye-section-head">
              <h3 class="neye-section-title">业务规模</h3>
            </div>
            <div class="dashboard-metrics">
              <a-statistic
                title="验光单"
                :value="overview?.counts.optometryOrders || 0"
              />
              <a-statistic
                title="配镜单"
                :value="overview?.counts.fittingOrders || 0"
              />
              <a-statistic
                title="商品项"
                :value="overview?.counts.productItems || 0"
              />
            </div>
            <a-alert
              type="info"
              show-icon
              :message="`近 ${overview?.trends.periodDays || 30} 天：验光单 ${overview?.trends.optometryOrders || 0}，配镜单 ${overview?.trends.fittingOrders || 0}`"
            />
          </section>
        </a-col>
        <a-col :xs="24" :lg="12">
          <section class="neye-panel dashboard-panel">
            <div class="neye-section-head">
              <h3 class="neye-section-title">导入任务治理</h3>
            </div>
            <div class="dashboard-metrics">
              <a-statistic
                title="总任务"
                :value="overview?.importTasks.total || 0"
              />
              <a-statistic
                title="等待/运行"
                :value="
                  (overview?.importTasks.pending || 0) +
                  (overview?.importTasks.running || 0)
                "
              />
              <a-statistic
                title="失败"
                :value="overview?.importTasks.failed || 0"
              />
            </div>
            <a-button
              type="link"
              class="neye-link-button"
              @click="router.push('/neye/system/import-tasks')"
              >进入导入任务管理</a-button
            >
          </section>
        </a-col>
      </a-row>

    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.dashboard-note {
  color: #6b7280;
  margin-top: 8px;
}
.dashboard-panel {
  height: 100%;
  margin: 0;
}
.dashboard-metrics {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 18px;
}
@media (max-width: 640px) {
  .dashboard-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
