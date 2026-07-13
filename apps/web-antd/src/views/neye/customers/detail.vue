<script setup lang="ts">
defineOptions({ name: 'NEyeCustomerDetail' });

import { computed, h, ref, watch } from 'vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { useTabbarStore } from '@vben/stores';
import { message } from 'ant-design-vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

import { apiRequest } from '#/api/neye';
import type { Customer, FittingOrder, OptometryOrder } from '#/types/neye';
import { formatDate, genderText, today } from '#/utils/neye-format';

import FittingOrderModal from '../components/FittingOrderModal.vue';
import OptometryOrderPanel from '../components/OptometryOrderPanel.vue';
import {
  customerWorkspaceLocation,
  resolveWorkspaceSelection,
  sortOptometryOrders,
} from '../customer-workspace';

interface OptometryPanelExpose {
  confirmDiscardChanges: () => Promise<boolean>;
  reload: () => Promise<void>;
}

const route = useRoute();
const router = useRouter();
const tabbarStore = useTabbarStore();
const customerId = computed(() => String(route.params.id));
const loading = ref(false);
const creatingOptometry = ref(false);
const customer = ref<Customer | null>(null);
const selectedOptometryId = ref<string>();
const selectedFittingId = ref<string>();
const fittingOpen = ref(false);
const optometryPanel = ref<OptometryPanelExpose>();
const optometryOrders = computed(() =>
  sortOptometryOrders(customer.value?.optometryOrders ?? []),
);

function fittingCount(orderId: string) {
  return (customer.value?.fittingOrders ?? []).filter(
    (item) => item.optometryOrderId === orderId,
  ).length;
}

function queryValue(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

async function syncRoute(optometryId?: string, fittingId?: string) {
  const currentOptometryId = queryValue(route.query.optometryId);
  const currentFittingId = queryValue(route.query.fittingId);
  if (
    currentOptometryId === (optometryId ?? '') &&
    currentFittingId === (fittingId ?? '')
  ) {
    return;
  }
  await router.replace(
    customerWorkspaceLocation(customerId.value, optometryId, fittingId),
  );
}

async function fetchCustomer() {
  const loaded = await apiRequest<Customer>(`/customers/${customerId.value}`);
  customer.value = loaded;
  await tabbarStore.setTabTitle(route, loaded.name);
  return loaded;
}

async function load() {
  loading.value = true;
  try {
    const loaded = await fetchCustomer();
    const orders = sortOptometryOrders(loaded.optometryOrders ?? []);
    const fittings = loaded.fittingOrders ?? [];
    const selection = resolveWorkspaceSelection(
      orders,
      fittings,
      queryValue(route.query.optometryId) || undefined,
      queryValue(route.query.fittingId) || undefined,
    );
    selectedOptometryId.value = selection.optometryId;
    selectedFittingId.value = selection.fitting?.id;
    fittingOpen.value = Boolean(selection.fitting);
    await syncRoute(selection.optometryId, selection.fitting?.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function selectOptometry(orderId: string) {
  if (selectedOptometryId.value === orderId) return;
  const canLeave =
    (await optometryPanel.value?.confirmDiscardChanges()) ?? true;
  if (!canLeave) return;
  selectedOptometryId.value = orderId;
  selectedFittingId.value = undefined;
  fittingOpen.value = false;
  await syncRoute(orderId);
}

async function createOptometryOrder() {
  const canLeave =
    (await optometryPanel.value?.confirmDiscardChanges()) ?? true;
  if (!canLeave) return;
  creatingOptometry.value = true;
  try {
    const order = await apiRequest<OptometryOrder>(
      `/customers/${customerId.value}/optometry-orders`,
      {
        body: JSON.stringify({ optometryDate: today() }),
        method: 'POST',
      },
    );
    await fetchCustomer();
    selectedOptometryId.value = order.id;
    message.success('验光单已创建，请填写验光数据');
    await syncRoute(order.id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  } finally {
    creatingOptometry.value = false;
  }
}

async function refreshCustomerRecords() {
  try {
    await fetchCustomer();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '刷新失败');
  }
}

async function handleOptometryDeleted() {
  await refreshCustomerRecords();
  selectedOptometryId.value = optometryOrders.value[0]?.id;
  await syncRoute(selectedOptometryId.value);
}

async function openFitting(order: FittingOrder) {
  selectedFittingId.value = order.id;
  fittingOpen.value = true;
  await syncRoute(selectedOptometryId.value, order.id);
}

async function handleFittingOpenChange(open: boolean) {
  fittingOpen.value = open;
  if (open) return;
  selectedFittingId.value = undefined;
  await syncRoute(selectedOptometryId.value);
}

async function handleFittingChanged() {
  await refreshCustomerRecords();
  await optometryPanel.value?.reload();
}

async function handleFittingDeleted() {
  await refreshCustomerRecords();
  await optometryPanel.value?.reload();
}

onBeforeRouteLeave(async () => {
  return (await optometryPanel.value?.confirmDiscardChanges()) ?? true;
});

watch(customerId, () => void load(), { immediate: true });
</script>

<template>
  <div class="neye-page neye-customer-page">
    <a-spin :spinning="loading">
      <div class="neye-page-head">
        <div>
          <h1 class="neye-page-title">{{ customer?.name || '客户详情' }}</h1>
          <p class="neye-page-subtitle">
            {{ customer?.customerNo }} / {{ customer?.phone || '未填手机号' }} /
            {{ genderText(customer?.gender) }} / {{ customer?.age ?? '-' }} 岁
          </p>
        </div>
        <a-space wrap>
          <a-button @click="router.push('/neye/customers')">返回列表</a-button>
          <a-button
            type="primary"
            :icon="h(PlusOutlined)"
            :loading="creatingOptometry"
            @click="createOptometryOrder"
          >
            新建验光单
          </a-button>
        </a-space>
      </div>

      <div v-if="customer" class="neye-customer-workspace">
        <aside class="neye-panel neye-optometry-sidebar">
          <div class="neye-sidebar-head">
            <div>
              <h2 class="neye-section-title">验光记录</h2>
              <p class="neye-page-subtitle">共 {{ optometryOrders.length }} 张</p>
            </div>
            <a-button
              type="text"
              shape="circle"
              :icon="h(PlusOutlined)"
              title="新建验光单"
              :loading="creatingOptometry"
              @click="createOptometryOrder"
            />
          </div>

          <div v-if="optometryOrders.length" class="neye-optometry-list">
            <button
              v-for="item in optometryOrders"
              :key="item.id"
              type="button"
              :class="[
                'neye-optometry-list-item',
                { active: selectedOptometryId === item.id },
              ]"
              @click="selectOptometry(item.id)"
            >
              <span class="neye-optometry-list-date">{{ formatDate(item.optometryDate) }}</span>
              <span class="neye-optometry-list-meta">{{ item.orderNo }}</span>
              <span class="neye-optometry-list-count">
                配镜单 {{ fittingCount(item.id) }} 张
              </span>
            </button>
          </div>
          <a-empty v-else :image="false" description="暂无验光记录">
            <a-button type="primary" @click="createOptometryOrder">新建验光单</a-button>
          </a-empty>
        </aside>

        <main class="neye-customer-detail-pane">
          <OptometryOrderPanel
            v-if="selectedOptometryId"
            :key="selectedOptometryId"
            ref="optometryPanel"
            :order-id="selectedOptometryId"
            @deleted="handleOptometryDeleted"
            @open-fitting="openFitting"
            @updated="refreshCustomerRecords"
          />
          <section v-else class="neye-panel neye-workspace-empty">
            <a-empty description="该客户还没有验光单">
              <a-button type="primary" @click="createOptometryOrder">新建验光单</a-button>
            </a-empty>
          </section>
        </main>
      </div>
    </a-spin>

    <FittingOrderModal
      :open="fittingOpen"
      :order-id="selectedFittingId"
      @changed="handleFittingChanged"
      @deleted="handleFittingDeleted"
      @update:open="handleFittingOpenChange"
    />
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.neye-customer-page {
  min-width: 0;
}
.neye-customer-workspace {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.neye-optometry-sidebar {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 150px);
  overflow: hidden;
  padding: 0;
}
.neye-sidebar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid hsl(var(--border));
}
.neye-sidebar-head .neye-section-title {
  margin-bottom: 0;
}
.neye-optometry-list {
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  padding: 8px;
}
.neye-optometry-list-item {
  display: block;
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--foreground));
  cursor: pointer;
  text-align: left;
  transition: background-color 0.16s ease;
}
.neye-optometry-list-item:hover {
  background: hsl(var(--muted) / 0.55);
}
.neye-optometry-list-item.active {
  background: hsl(var(--primary) / 0.1);
  box-shadow: inset 3px 0 hsl(var(--primary));
}
.neye-optometry-list-date,
.neye-optometry-list-meta,
.neye-optometry-list-count {
  display: block;
}
.neye-optometry-list-date {
  font-size: 15px;
  font-weight: 650;
}
.neye-optometry-list-meta,
.neye-optometry-list-count {
  margin-top: 4px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neye-customer-detail-pane {
  min-width: 0;
}
.neye-workspace-empty {
  display: grid;
  min-height: 360px;
  place-items: center;
}
@media (max-width: 1100px) {
  .neye-customer-workspace {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}
@media (max-width: 840px) {
  .neye-customer-workspace {
    grid-template-columns: 1fr;
  }
  .neye-optometry-sidebar {
    position: static;
    max-height: none;
  }
  .neye-optometry-list {
    display: flex;
    gap: 8px;
    max-height: none;
    overflow-x: auto;
  }
  .neye-optometry-list-item {
    flex: 0 0 190px;
  }
}
</style>