<script setup lang="ts">
defineOptions({ name: 'NEyeCustomerDetail' });
import { computed, h, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { apiRequest } from '#/api/neye';
import type { Customer, FittingOrder, OptometryOrder } from '#/types/neye';
import { formatDate, genderText, money, today } from '#/utils/neye-format';

const route = useRoute();
const router = useRouter();
const customerId = computed(() => String(route.params.id));
const loading = ref(false);
const creatingOptometry = ref(false);
const customer = ref<Customer | null>(null);
const optometryColumns = [
  { title: '验光单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '验光日期', dataIndex: 'optometryDate', key: 'optometryDate', width: 130 },
  { title: '远瞳距', dataIndex: 'farPd', key: 'farPd', width: 120 },
  { title: '操作', key: 'action', width: 100 },
];
const fittingColumns = [
  { title: '配镜单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '镜架', dataIndex: 'frameInfo', key: 'frameInfo' },
  { title: '镜片', dataIndex: 'lensInfo', key: 'lensInfo' },
  { title: '金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 100 },
];
const optometryOrders = computed<OptometryOrder[]>(() => customer.value?.optometryOrders ?? []);
const fittingOrders = computed<FittingOrder[]>(() => customer.value?.fittingOrders ?? []);

async function load() {
  loading.value = true;
  try {
    customer.value = await apiRequest<Customer>(`/customers/${customerId.value}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function createOptometryOrder() {
  creatingOptometry.value = true;
  try {
    const order = await apiRequest<OptometryOrder>(`/customers/${customerId.value}/optometry-orders`, { method: 'POST', body: JSON.stringify({ optometryDate: today() }) });
    message.success('验光单已创建，请填写验光数据');
    router.push(`/neye/optometry-orders/${order.id}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  } finally {
    creatingOptometry.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <a-spin :spinning="loading">
      <div class="neye-page-head">
        <div>
          <h1 class="neye-page-title">{{ customer?.name || '客户详情' }}</h1>
          <p class="neye-page-subtitle">{{ customer?.customerNo }} / {{ customer?.phone || '未填手机号' }} / {{ genderText(customer?.gender) }} / {{ customer?.age ?? '-' }} 岁</p>
        </div>
        <a-space>
          <a-button @click="router.push('/neye/customers')">返回列表</a-button>
          <a-button type="primary" :icon="h(PlusOutlined)" :loading="creatingOptometry" @click="createOptometryOrder">新建验光单</a-button>
        </a-space>
      </div>

      <section class="neye-panel" style="margin-bottom: 14px">
        <h2 class="neye-section-title">验光单</h2>
        <a-table row-key="id" :columns="optometryColumns" :data-source="optometryOrders" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'optometryDate'">{{ formatDate(record.optometryDate) }}</template>
            <template v-else-if="column.key === 'farPd'">{{ record.farPd || '' }}</template>
            <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/optometry-orders/${record.id}`)">详情</a-button></template>
          </template>
        </a-table>
      </section>

      <section class="neye-panel">
        <h2 class="neye-section-title">配镜单</h2>
        <a-table row-key="id" :columns="fittingColumns" :data-source="fittingOrders" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'totalAmount'"><span class="neye-money">{{ money(record.totalAmount) }}</span></template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
            <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/fitting-orders/${record.id}`)">详情</a-button></template>
          </template>
        </a-table>
      </section>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>