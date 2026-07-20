<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Modal, message } from 'ant-design-vue';

import { apiRequest, pickupNotificationsApi } from '#/api/neye';
import type {
  FittingOrder,
  PickupNotificationAttempt,
  PickupNotificationQr,
} from '#/types/neye';
import { formatDate } from '#/utils/neye-format';

import {
  pickupActions,
  pickupStatusMeta,
} from '../fitting-orders/pickup-notification';

const props = defineProps<{ orderId?: string }>();
const emit = defineEmits<{ changed: [] }>();
const loading = ref(false);
const actionLoading = ref(false);
const order = ref<FittingOrder>();
const attempts = ref<PickupNotificationAttempt[]>([]);
const qr = ref<PickupNotificationQr>();
const qrOpen = ref(false);
const retryOpen = ref(false);
const retryReason = ref('配置已修复，人工重新发送');
const statusMeta = computed(() =>
  pickupStatusMeta(order.value?.pickupNotification?.status),
);
const actions = computed(() =>
  order.value
    ? pickupActions(order.value)
    : { canGenerateQr: false, canMarkReady: false, canRetry: false },
);

async function load() {
  if (!props.orderId) {
    order.value = undefined;
    attempts.value = [];
    return;
  }
  loading.value = true;
  try {
    const [current, history] = await Promise.all([
      apiRequest<FittingOrder>(`/fitting-orders/${props.orderId}`),
      pickupNotificationsApi.getAttempts(props.orderId),
    ]);
    order.value = current;
    attempts.value = history.items;
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '取镜通知状态加载失败',
    );
  } finally {
    loading.value = false;
  }
}

async function showQr() {
  if (!props.orderId) return;
  actionLoading.value = true;
  try {
    qr.value = await pickupNotificationsApi.getQr(props.orderId);
    qrOpen.value = true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '小程序码生成失败');
  } finally {
    actionLoading.value = false;
  }
}

function markReady() {
  if (!props.orderId) return;
  Modal.confirm({
    title: '确认眼镜已可取？',
    content:
      '确认后接收人将锁定；如已订阅，系统会开始发送一次取镜通知。未订阅也可标记，顾客后续订阅将立即发送。此时间不可撤销。',
    okText: '确认可取',
    cancelText: '取消',
    async onOk() {
      await pickupNotificationsApi.markReady(props.orderId as string);
      message.success('已标记眼镜可取');
      await load();
      emit('changed');
    },
  });
}

async function retry() {
  if (!props.orderId || retryReason.value.trim().length < 5) {
    message.warning('请输入至少 5 个字符的重试原因');
    return;
  }
  actionLoading.value = true;
  try {
    await pickupNotificationsApi.retry(props.orderId, retryReason.value.trim());
    message.success('已创建新的重试周期');
    retryOpen.value = false;
    await load();
    emit('changed');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重试失败');
  } finally {
    actionLoading.value = false;
  }
}

watch(
  () => props.orderId,
  () => void load(),
  { immediate: true },
);
</script>

<template>
  <section v-if="orderId" class="neye-panel pickup-panel">
    <a-spin :spinning="loading">
      <div class="pickup-head">
        <div>
          <h2 class="neye-section-title">取镜通知</h2>
          <a-space wrap>
            <a-tag :color="statusMeta.color">{{ statusMeta.label }}</a-tag>
            <span class="neye-page-subtitle">配镜单 {{ order?.orderNo }}</span>
          </a-space>
        </div>
        <a-space wrap>
          <a-button
            :disabled="!actions.canGenerateQr"
            :loading="actionLoading"
            @click="showQr"
            >订阅小程序码</a-button
          >
          <a-button
            :disabled="!actions.canMarkReady"
            type="primary"
            @click="markReady"
            >标记眼镜可取</a-button
          >
          <a-button v-if="actions.canRetry" danger @click="retryOpen = true"
            >人工重试</a-button
          >
        </a-space>
      </div>
      <a-descriptions v-if="order" size="small" :column="2" bordered>
        <a-descriptions-item label="可取时间">{{
          order.readyForPickupAt
            ? formatDate(order.readyForPickupAt)
            : '尚未标记'
        }}</a-descriptions-item>
        <a-descriptions-item label="接收人">{{
          order.pickupNotification?.receiverSubscribed
            ? order.pickupNotification.receiverLocked
              ? '已订阅并锁定'
              : '已订阅，可更新'
            : '未订阅'
        }}</a-descriptions-item>
        <a-descriptions-item label="发送次数"
          >{{ order.pickupNotification?.attempts ?? 0 }} / 本周期最多
          {{
            order.pickupNotification?.maxAttemptsPerCycle ?? 5
          }}</a-descriptions-item
        >
        <a-descriptions-item label="下次重试">{{
          order.pickupNotification?.nextRetryAt
            ? formatDate(order.pickupNotification.nextRetryAt)
            : '-'
        }}</a-descriptions-item>
        <a-descriptions-item
          v-if="order.pickupNotification?.failureSummary"
          label="失败原因"
          :span="2"
          >{{ order.pickupNotification.failureSummary }}</a-descriptions-item
        >
      </a-descriptions>
      <a-collapse v-if="attempts.length" class="attempts">
        <a-collapse-panel key="history" header="发送记录">
          <a-timeline>
            <a-timeline-item
              v-for="item in attempts"
              :key="`${item.cycle}-${item.attemptNo}`"
              :color="
                item.result === 'sent'
                  ? 'green'
                  : item.result === 'processing'
                    ? 'blue'
                    : 'red'
              "
            >
              第 {{ item.cycle }} 周期 / 第 {{ item.attemptNo }} 次 ·
              {{ item.result }} · {{ formatDate(item.startedAt) }}
              <div v-if="item.errorSummary" class="neye-page-subtitle">
                {{ item.errorSummary }}
              </div>
            </a-timeline-item>
          </a-timeline>
        </a-collapse-panel>
      </a-collapse>
    </a-spin>

    <a-modal v-model:open="qrOpen" title="取镜通知订阅码" :footer="null">
      <div class="qr-content">
        <img v-if="qr" :src="qr.qrCodeDataUrl" alt="取镜通知订阅小程序码" />
        <p>请让顾客或代取人微信扫码并同意一次性订阅。</p>
        <p v-if="qr" class="neye-page-subtitle">
          有效期至 {{ formatDate(qr.expiresAt) }}
        </p>
      </div>
    </a-modal>
    <a-modal
      v-model:open="retryOpen"
      title="人工重试取镜通知"
      :confirm-loading="actionLoading"
      ok-text="开始重试"
      @ok="retry"
    >
      <a-alert
        type="warning"
        show-icon
        message="仅在配置或临时故障已修复后重试；不会向已成功发送的订单重复发送。"
      />
      <a-textarea
        v-model:value="retryReason"
        class="retry-reason"
        :maxlength="500"
        show-count
        :rows="4"
      />
    </a-modal>
  </section>
</template>

<style scoped>
.pickup-panel {
  margin-top: 14px;
}
.pickup-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.attempts {
  margin-top: 16px;
}
.qr-content {
  text-align: center;
}
.qr-content img {
  width: 280px;
  max-width: 100%;
}
.retry-reason {
  margin-top: 16px;
}
</style>
