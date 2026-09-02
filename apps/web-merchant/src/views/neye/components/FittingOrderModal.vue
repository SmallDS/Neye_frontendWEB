<script setup lang="ts">
import type { FittingOrder } from '#/types/neye';

import { computed, h, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';

import {
  apiRequest,
  cleanPayload,
  commerceApi,
  idempotencyHeaders,
} from '#/api/neye';
import { useNeyePermissions } from '#/composables/useNeyePermissions';
import { formatDate, money } from '#/utils/neye-format';

const props = defineProps<{
  open: boolean;
  orderId?: string;
}>();
const emit = defineEmits<{
  changed: [];
  deleted: [];
  'update:open': [value: boolean];
}>();
const router = useRouter();
const { can } = useNeyePermissions();

const loading = ref(false);
const saving = ref(false);
const editing = ref(false);
const order = ref<FittingOrder | null>(null);
const editForm = reactive({
  frameInfo: '',
  framePrice: '',
  lensInfo: '',
  lensPrice: '',
  otherInfo: '',
  otherPrice: '',
  remark: '',
});
const previewTotal = computed(() =>
  money(
    Number(editForm.framePrice || 0) +
      Number(editForm.lensPrice || 0) +
      Number(editForm.otherPrice || 0),
  ),
);

function close() {
  editing.value = false;
  emit('update:open', false);
}

async function load() {
  if (!props.open || !props.orderId) {
    order.value = null;
    return;
  }
  loading.value = true;
  try {
    order.value = await apiRequest<FittingOrder>(
      `/fitting-orders/${props.orderId}`,
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
    close();
  } finally {
    loading.value = false;
  }
}

function openEdit() {
  if (!can('fitting.write'))
    return message.warning('当前账号没有编辑配镜单的权限，请联系管理员');
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
  editing.value = true;
}

async function submitEdit() {
  if (!can('fitting.write'))
    return message.warning('当前账号没有编辑配镜单的权限，请联系管理员');
  if (!props.orderId) return;
  saving.value = true;
  try {
    await apiRequest<FittingOrder>(`/fitting-orders/${props.orderId}`, {
      body: JSON.stringify(cleanPayload(editForm)),
      headers: idempotencyHeaders(),
      method: 'PATCH',
    });
    message.success('配镜单及关联收银单已同步更新');
    editing.value = false;
    await load();
    emit('changed');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  } finally {
    saving.value = false;
  }
}

function removeOrder() {
  if (!can('fitting.write'))
    return message.warning('当前账号没有删除配镜单的权限，请联系管理员');
  if (!order.value || !props.orderId) return;
  Modal.confirm({
    cancelText: '取消',
    content: `确认删除配镜单 ${order.value.orderNo}？历史记录将不再显示。`,
    okText: '删除',
    okType: 'danger',
    title: '删除配镜单',
    async onOk() {
      await apiRequest(`/fitting-orders/${props.orderId}`, {
        method: 'DELETE',
      });
      message.success('配镜单已删除');
      close();
      emit('deleted');
    },
  });
}

async function goCheckout() {
  if (!can('checkout.create'))
    return message.warning('当前账号没有进入收银开单的权限，请联系管理员');
  if (!order.value) return;
  saving.value = true;
  try {
    const sale = await commerceApi.createFittingSale(order.value.id);
    const confirmed = await commerceApi.confirmSale(sale.id);
    close();
    await router.push({
      path: '/neye/commerce/checkout',
      query: { saleId: confirmed.id },
    });
  } catch (error) {
    message.error(error instanceof Error ? error.message : '进入收银失败');
  } finally {
    saving.value = false;
  }
}

watch(
  () => [props.open, props.orderId],
  () => {
    editing.value = false;
    void load();
  },
  { immediate: true },
);
</script>

<template>
  <a-modal
    :open="open"
    :title="order?.orderNo || '配镜单详情'"
    width="760px"
    :footer="null"
    destroy-on-close
    @cancel="close"
  >
    <a-spin :spinning="loading">
      <template v-if="order">
        <div class="neye-fitting-modal-head">
          <div>
            <div class="neye-fitting-customer">
              {{ order.customer?.name || '-' }}
            </div>
            <div class="neye-page-subtitle">
              {{ formatDate(order.createdAt) }}
            </div>
          </div>
          <a-space>
            <a-button
              v-if="!editing && can('checkout.create')"
              type="primary"
              :loading="saving"
              @click="goCheckout"
            >
              去收银
            </a-button>
            <a-button v-if="editing" @click="editing = false">
              取消编辑
            </a-button>
            <a-button
              v-else-if="can('fitting.write')"
              :icon="h(EditOutlined)"
              @click="openEdit"
            >
              编辑
            </a-button>
            <a-button
              v-if="can('fitting.write')"
              danger
              :icon="h(DeleteOutlined)"
              @click="removeOrder"
            >
              删除
            </a-button>
          </a-space>
        </div>

        <a-form
          v-if="editing"
          layout="vertical"
          :model="editForm"
          @finish="submitEdit"
        >
          <div class="neye-form-grid">
            <a-form-item label="镜架品名">
              <a-input v-model:value="editForm.frameInfo" />
            </a-form-item>
            <a-form-item label="镜架价格">
              <a-input v-model:value="editForm.framePrice" />
            </a-form-item>
          </div>
          <div class="neye-form-grid">
            <a-form-item label="镜片品名">
              <a-input v-model:value="editForm.lensInfo" />
            </a-form-item>
            <a-form-item label="镜片价格">
              <a-input v-model:value="editForm.lensPrice" />
            </a-form-item>
          </div>
          <div class="neye-form-grid">
            <a-form-item label="其他品名">
              <a-input v-model:value="editForm.otherInfo" />
            </a-form-item>
            <a-form-item label="其他价格">
              <a-input v-model:value="editForm.otherPrice" />
            </a-form-item>
          </div>
          <a-form-item label="备注">
            <a-textarea v-model:value="editForm.remark" :rows="3" />
          </a-form-item>
          <div class="neye-total-line">
            预计金额：<span class="neye-money">{{ previewTotal }}</span>
          </div>
          <a-button
            type="primary"
            html-type="submit"
            :icon="h(SaveOutlined)"
            :loading="saving"
          >
            保存
          </a-button>
        </a-form>

        <template v-else>
          <div class="neye-fitting-detail-grid">
            <div class="neye-fitting-detail-item">
              <span>镜架</span><strong>{{ order.frameInfo || '-' }}</strong
              ><em>{{ money(order.framePrice) }}</em>
            </div>
            <div class="neye-fitting-detail-item">
              <span>镜片</span><strong>{{ order.lensInfo || '-' }}</strong
              ><em>{{ money(order.lensPrice) }}</em>
            </div>
            <div class="neye-fitting-detail-item">
              <span>其他</span><strong>{{ order.otherInfo || '-' }}</strong
              ><em>{{ money(order.otherPrice) }}</em>
            </div>
          </div>
          <div class="neye-fitting-total">
            <span>配镜金额</span><strong>{{ money(order.totalAmount) }}</strong>
          </div>
          <div class="neye-fitting-remark">
            <span>备注</span>
            <p>{{ order.remark || '无备注' }}</p>
          </div>
        </template>
      </template>
    </a-spin>
  </a-modal>
</template>

<style src="../neye.css"></style>
<style scoped>
.neye-fitting-modal-head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.neye-fitting-customer {
  font-size: 18px;
  font-weight: 650;
  color: hsl(var(--foreground));
}

.neye-fitting-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.neye-fitting-detail-item {
  min-width: 0;
  padding: 18px;
  border-right: 1px solid hsl(var(--border));
}

.neye-fitting-detail-item:last-child {
  border-right: 0;
}

.neye-fitting-detail-item span,
.neye-fitting-remark span {
  display: block;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.neye-fitting-detail-item strong {
  display: block;
  margin-top: 8px;
  font-size: 16px;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.neye-fitting-detail-item em {
  display: block;
  margin-top: 8px;
  font-style: normal;
  font-weight: 650;
  color: #b45309;
}

.neye-fitting-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-top: 14px;
  background: hsl(var(--muted) / 45%);
  border-radius: 8px;
}

.neye-fitting-total strong {
  font-size: 20px;
  color: #b45309;
}

.neye-fitting-remark {
  margin-top: 18px;
}

.neye-fitting-remark p {
  margin: 8px 0 0;
  color: hsl(var(--foreground));
  white-space: pre-wrap;
}

@media (max-width: 640px) {
  .neye-fitting-modal-head {
    display: block;
  }

  .neye-fitting-detail-grid {
    grid-template-columns: 1fr;
  }

  .neye-fitting-detail-item {
    border-right: 0;
    border-bottom: 1px solid hsl(var(--border));
  }

  .neye-fitting-detail-item:last-child {
    border-bottom: 0;
  }
}
</style>
