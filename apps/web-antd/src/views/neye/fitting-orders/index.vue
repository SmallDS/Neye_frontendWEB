<script setup lang="ts">
defineOptions({ name: 'NEyeFittingOrders' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue';
import type { Dayjs } from 'dayjs';
import { apiRequest } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';
import type {
  BatchDeleteResult,
  FittingOrder,
  PageResult,
  PickupNotificationStatus,
} from '#/types/neye';
import { formatDate, money } from '#/utils/neye-format';
import PickupNotificationPanel from '../components/PickupNotificationPanel.vue';
import { customerWorkspaceLocation } from '../customer-workspace';
import { pickupStatusMeta } from './pickup-notification';

const router = useRouter();
const loading = ref(false);
const selectedRowKeys = ref<string[]>([]);
const selectedCount = computed(() => selectedRowKeys.value.length);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
}));
const query = reactive<{
  keyword: string;
  notificationStatus?: PickupNotificationStatus;
  page: number;
  pageSize: number;
}>({ keyword: '', page: 1, pageSize: 10 });
const readyRange = ref<[Dayjs, Dayjs]>();
const notificationOrderId = ref<string>();
const notificationOpen = ref(false);
const result = ref<PageResult<FittingOrder>>({
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
});
const notificationOptions = [
  { label: '未订阅', value: 'unsubscribed' },
  { label: '待发送', value: 'pending' },
  { label: '重试中', value: 'retrying' },
  { label: '已发送', value: 'sent' },
  { label: '发送失败', value: 'failed' },
];
const {
  appendTenantParam,
  isTenantReady,
  isTenantSelectorVisible,
  loadTenants,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
} = useNeyeTenantScope();
const columns = [
  { title: '配镜单号', dataIndex: 'orderNo', key: 'orderNo', width: 160 },
  { title: '客户', key: 'customer', width: 110 },
  { title: '镜架', dataIndex: 'frameInfo', key: 'frameInfo' },
  { title: '镜片', dataIndex: 'lensInfo', key: 'lensInfo' },
  { title: '金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 105 },
  { title: '通知状态', key: 'notificationStatus', width: 110 },
  { title: '可取时间', key: 'readyForPickupAt', width: 145 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 150 },
];

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  selectedRowKeys.value = [];
  try {
    await loadTenants();
    if (!isTenantReady.value) {
      result.value = {
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize,
      };
      return;
    }
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.notificationStatus)
      params.set('notificationStatus', query.notificationStatus);
    if (readyRange.value) {
      params.set(
        'readyAtFrom',
        readyRange.value[0].startOf('day').toISOString(),
      );
      params.set('readyAtTo', readyRange.value[1].endOf('day').toISOString());
    }
    appendTenantParam(params);
    result.value = await apiRequest<PageResult<FittingOrder>>(
      `/fitting-orders?${params}`,
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function showNotification(order: FittingOrder) {
  notificationOrderId.value = order.id;
  notificationOpen.value = true;
}

function batchRemoveFittingOrders() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择配镜单');
    return;
  }
  Modal.confirm({
    title: '批量删除配镜单',
    content: `确认删除选中的 ${selectedRowKeys.value.length} 张配镜单？`,
    okText: '批量删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>(
        '/fitting-orders/batch-delete',
        {
          method: 'POST',
          body: JSON.stringify({
            ids: selectedRowKeys.value,
            ...(isTenantSelectorVisible.value && selectedTenantId.value
              ? { tenantId: selectedTenantId.value }
              : {}),
          }),
        },
      );
      message.success(`已删除 ${deleted.deletedCount} 张配镜单`);
      await load(1);
    },
  });
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}

function tenantFilterOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '')
    .toLowerCase()
    .includes(input.toLowerCase());
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">配镜单</h1>
        <p class="neye-page-subtitle">查询配镜单并管理一次性取镜通知</p>
      </div>
    </div>
    <section class="neye-panel">
      <div class="neye-toolbar">
        <a-select
          v-if="isTenantSelectorVisible"
          v-model:value="selectedTenantId"
          show-search
          :filter-option="tenantFilterOption"
          :loading="tenantLoading"
          :options="tenantOptions"
          placeholder="选择租户"
          class="neye-tenant-select"
          @change="load(1)"
        />
        <a-input
          v-model:value="query.keyword"
          allow-clear
          placeholder="客户 / 单号 / 商品信息"
          style="width: 280px"
          @press-enter="load(1)"
        />
        <a-select
          v-model:value="query.notificationStatus"
          allow-clear
          :options="notificationOptions"
          placeholder="通知状态"
          style="width: 130px"
        />
        <a-range-picker v-model:value="readyRange" allow-clear />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button
          danger
          :disabled="selectedCount === 0"
          :icon="h(DeleteOutlined)"
          @click="batchRemoveFittingOrders"
          >批量删除{{ selectedCount ? ` ${selectedCount}` : '' }}</a-button
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
        :row-selection="rowSelection"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'customer'">{{
            record.customer?.name || '-'
          }}</template>
          <template v-else-if="column.key === 'totalAmount'"
            ><span class="neye-money">{{
              money(record.totalAmount)
            }}</span></template
          >
          <template v-else-if="column.key === 'notificationStatus'"
            ><a-tag
              :color="pickupStatusMeta(record.pickupNotification?.status).color"
              >{{
                pickupStatusMeta(record.pickupNotification?.status).label
              }}</a-tag
            ></template
          >
          <template v-else-if="column.key === 'readyForPickupAt'">{{
            record.readyForPickupAt ? formatDate(record.readyForPickupAt) : '-'
          }}</template>
          <template v-else-if="column.key === 'createdAt'">{{
            formatDate(record.createdAt)
          }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button
              type="link"
              class="neye-link-button"
              @click="showNotification(record)"
              >通知</a-button
            >
            <a-button
              type="link"
              class="neye-link-button"
              @click="
                router.push(
                  customerWorkspaceLocation(
                    record.customerId,
                    record.optometryOrderId,
                    record.id,
                  ),
                )
              "
              >详情</a-button
            >
          </template>
        </template>
      </a-table>
    </section>
    <a-modal
      v-model:open="notificationOpen"
      title="取镜通知管理"
      :footer="null"
      width="820px"
    >
      <PickupNotificationPanel
        :order-id="notificationOrderId"
        @changed="load(query.page)"
      />
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
