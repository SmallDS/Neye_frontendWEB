<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { SvgWeChatIcon } from '@vben/icons';

import { message, Modal } from 'ant-design-vue';

import type { CurrentUser } from '#/types/neye';

import {
  createWechatBindingSessionApi,
  getCurrentUserApi,
  pollWechatSessionApi,
  unbindWechatApi,
} from '#/api';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();
const user = ref<CurrentUser>();
const loading = ref(false);
const binding = ref(false);
const qrCodeDataUrl = ref('');
const sessionId = ref('');
const statusText = ref('');
let pollTimer: ReturnType<typeof setInterval> | undefined;

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
}

async function load() {
  loading.value = true;
  try {
    user.value = await getCurrentUserApi();
  } finally {
    loading.value = false;
  }
}

async function startBinding() {
  binding.value = true;
  qrCodeDataUrl.value = '';
  statusText.value = '正在生成小程序码';
  stopPolling();
  try {
    const session = await createWechatBindingSessionApi();
    sessionId.value = session.id;
    qrCodeDataUrl.value = session.qrCodeDataUrl;
    statusText.value = '请使用要绑定的微信扫描';
    pollTimer = setInterval(() => void pollBinding(), 1500);
  } catch (error) {
    binding.value = false;
    statusText.value = error instanceof Error ? error.message : '小程序码生成失败';
    message.error(statusText.value);
  }
}

async function pollBinding() {
  if (!sessionId.value) return;
  try {
    const result = await pollWechatSessionApi(sessionId.value);
    if (result.status === 'confirmed') {
      stopPolling();
      binding.value = false;
      qrCodeDataUrl.value = '';
      await Promise.all([load(), authStore.fetchUserInfo()]);
      message.success('微信已绑定');
    } else if (result.status === 'expired') {
      stopPolling();
      binding.value = false;
      statusText.value = '小程序码已过期';
    }
  } catch (error) {
    stopPolling();
    binding.value = false;
    message.error(error instanceof Error ? error.message : '绑定状态获取失败');
  }
}

function confirmUnbind() {
  Modal.confirm({
    title: '解除微信绑定',
    content: '解绑后将无法使用该微信登录，确认继续吗？',
    okText: '确认解绑',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await unbindWechatApi();
      await Promise.all([load(), authStore.fetchUserInfo()]);
      message.success('微信已解绑');
    },
  });
}

onMounted(() => void load());
onBeforeUnmount(stopPolling);
</script>

<template>
  <section class="max-w-2xl">
    <h2 class="mb-1 text-lg font-semibold">微信绑定</h2>
    <p class="mb-6 text-sm text-foreground/60">
      绑定后可使用微信小程序自动登录，也可在 Web 端扫码登录。
    </p>

    <a-spin :spinning="loading">
      <a-descriptions :column="1" bordered>
        <a-descriptions-item label="当前状态">
          <a-tag :color="user?.wechatBound ? 'green' : 'default'">
            {{ user?.wechatBound ? '已绑定' : '未绑定' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="账号">
          {{ user?.username || '-' }}
        </a-descriptions-item>
      </a-descriptions>

      <div class="mt-5">
        <a-button
          v-if="user?.wechatBound"
          danger
          @click="confirmUnbind"
        >
          解除绑定
        </a-button>
        <a-button
          v-else
          type="primary"
          :loading="binding"
          @click="startBinding"
        >
          <template #icon><SvgWeChatIcon /></template>
          绑定微信
        </a-button>
      </div>

      <div v-if="qrCodeDataUrl" class="wechat-bind-panel">
        <img :src="qrCodeDataUrl" alt="绑定微信的小程序码" />
        <p>{{ statusText }}</p>
      </div>
      <a-alert
        v-else-if="statusText"
        class="mt-4"
        :message="statusText"
        type="info"
        show-icon
      />
    </a-spin>
  </section>
</template>

<style scoped>
.wechat-bind-panel {
  display: flex;
  margin-top: 20px;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.wechat-bind-panel img {
  width: 220px;
  height: 220px;
}

.wechat-bind-panel p {
  margin: 0;
  color: hsl(var(--muted-foreground));
}
</style>
