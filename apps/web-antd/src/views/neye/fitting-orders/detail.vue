<script setup lang="ts">
defineOptions({ name: 'NEyeFittingDetail' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
import { apiRequest, cleanPayload } from '#/api/neye';
import type { FittingOrder } from '#/types/neye';
import { formatDate, money } from '#/utils/neye-format';

const route = useRoute();
const router = useRouter();
const orderId = computed(() => String(route.params.id));
const loading = ref(false);
const editOpen = ref(false);
const order = ref<FittingOrder | null>(null);
const editForm = reactive({ frameInfo: '', framePrice: '', lensInfo: '', lensPrice: '', otherInfo: '', otherPrice: '', remark: '' });
const previewTotal = computed(() => money(Number(editForm.framePrice || 0) + Number(editForm.lensPrice || 0) + Number(editForm.otherPrice || 0)));

async function load() {
  loading.value = true;
  try {
    order.value = await apiRequest<FittingOrder>(`/fitting-orders/${orderId.value}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function openEdit() {
  if (!order.value) return;
  Object.assign(editForm, {
    frameInfo: order.value.frameInfo ?? '',
    framePrice: String(order.value.framePrice ?? ''),
    lensInfo: order.value.lensInfo ?? '',
    lensPrice: String(order.value.lensPrice ?? ''),
    otherInfo: order.value.otherInfo ?? '',
    otherPrice: String(order.value.otherPrice ?? ''),
    remark: order.value.remark ?? '',
  });
  editOpen.value = true;
}

async function submitEdit() {
  try {
    await apiRequest<FittingOrder>(`/fitting-orders/${orderId.value}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(editForm)) });
    message.success('配镜单已更新');
    editOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  }
}

function removeOrder() {
  if (!order.value) return;
  Modal.confirm({
    title: '删除配镜单',
    content: `确认删除配镜单 ${order.value.orderNo}？历史记录将不再显示。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await apiRequest(`/fitting-orders/${orderId.value}`, { method: 'DELETE' });
      message.success('配镜单已删除');
      router.push('/neye/fitting-orders');
    },
  });
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <a-spin :spinning="loading">
      <div class="neye-page-head">
        <div>
          <h1 class="neye-page-title">{{ order?.orderNo || '配镜单详情' }}</h1>
          <p class="neye-page-subtitle">{{ order?.customer?.name || '-' }} / {{ formatDate(order?.createdAt) }}</p>
        </div>
        <a-space>
          <a-button @click="router.push('/neye/fitting-orders')">返回列表</a-button>
          <a-button @click="router.push(`/neye/customers/${order?.customerId}`)">客户详情</a-button>
          <a-button @click="router.push(`/neye/optometry-orders/${order?.optometryOrderId}`)">验光单</a-button>
          <a-button :icon="h(EditOutlined)" @click="openEdit">编辑</a-button>
          <a-button danger :icon="h(DeleteOutlined)" @click="removeOrder">删除</a-button>
        </a-space>
      </div>

      <div class="neye-stat-row">
        <div class="neye-stat-box"><div class="neye-stat-label">镜架</div><div class="neye-stat-value">{{ money(order?.framePrice) }}</div><div class="neye-stat-note">{{ order?.frameInfo || '-' }}</div></div>
        <div class="neye-stat-box"><div class="neye-stat-label">镜片</div><div class="neye-stat-value">{{ money(order?.lensPrice) }}</div><div class="neye-stat-note">{{ order?.lensInfo || '-' }}</div></div>
        <div class="neye-stat-box"><div class="neye-stat-label">其他</div><div class="neye-stat-value">{{ money(order?.otherPrice) }}</div><div class="neye-stat-note">{{ order?.otherInfo || '-' }}</div></div>
        <div class="neye-stat-box"><div class="neye-stat-label">配镜金额</div><div class="neye-stat-value neye-money">{{ money(order?.totalAmount) }}</div></div>
      </div>

      <section class="neye-panel">
        <h2 class="neye-section-title">备注</h2>
        <p class="neye-empty-text">{{ order?.remark || '无备注' }}</p>
      </section>
    </a-spin>

    <a-modal v-model:open="editOpen" title="编辑配镜单" width="760px" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="editForm" @finish="submitEdit">
        <div class="neye-form-grid"><a-form-item label="镜架价格"><a-input v-model:value="editForm.framePrice" /></a-form-item><a-form-item label="镜架信息"><a-input v-model:value="editForm.frameInfo" /></a-form-item></div>
        <div class="neye-form-grid"><a-form-item label="镜片价格"><a-input v-model:value="editForm.lensPrice" /></a-form-item><a-form-item label="镜片信息"><a-input v-model:value="editForm.lensInfo" /></a-form-item></div>
        <div class="neye-form-grid"><a-form-item label="其他价格"><a-input v-model:value="editForm.otherPrice" /></a-form-item><a-form-item label="其他信息"><a-input v-model:value="editForm.otherInfo" /></a-form-item></div>
        <a-form-item label="备注"><a-textarea v-model:value="editForm.remark" :rows="3" /></a-form-item>
        <div class="neye-total-line">预计金额：<span class="neye-money">{{ previewTotal }}</span></div>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="editOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>