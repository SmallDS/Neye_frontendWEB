<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, onBeforeUnmount, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { SvgWeChatIcon } from '@vben/icons';

import { message } from 'ant-design-vue';

import {
  createWechatLoginSessionApi,
  getWechatAuthConfigApi,
  pollWechatSessionApi,
} from '#/api';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();
const qrOpen = ref(false);
const qrLoading = ref(false);
const qrCodeDataUrl = ref('');
const qrStatus = ref('请使用微信扫描二维码');
const sessionId = ref('');
const pollActive = ref(false);
let pollTimer: ReturnType<typeof setInterval> | undefined;

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: { placeholder: '请输入账号' },
    fieldName: 'username',
    label: '账号',
    rules: z.string().min(1, { message: '请输入账号' }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: { placeholder: '请输入密码' },
    fieldName: 'password',
    label: '密码',
    rules: z.string().min(1, { message: '请输入密码' }),
  },
]);

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = undefined;
  pollActive.value = false;
}

async function pollSession() {
  if (!sessionId.value) return;
  try {
    const result = await pollWechatSessionApi(sessionId.value);
    if (result.status === 'binding_required') {
      qrStatus.value = '该微信尚未绑定，请在小程序中绑定账号';
      return;
    }
    if (result.status === 'expired') {
      qrStatus.value = '二维码已过期，请重新获取';
      stopPolling();
      return;
    }
    if (result.status === 'consumed') {
      qrStatus.value = '二维码已使用';
      stopPolling();
      return;
    }
    if (result.status === 'authenticated' && result.accessToken) {
      stopPolling();
      qrOpen.value = false;
      await authStore.authLoginWithToken(result.accessToken);
    }
  } catch (error) {
    stopPolling();
    qrStatus.value = error instanceof Error ? error.message : '扫码状态获取失败';
  }
}

async function openWechatLogin() {
  qrOpen.value = true;
  qrLoading.value = true;
  qrCodeDataUrl.value = '';
  qrStatus.value = '正在生成小程序码';
  stopPolling();
  try {
    const config = await getWechatAuthConfigApi();
    if (!config.enabled) throw new Error('管理员尚未启用微信登录');
    if (!config.appId || !config.secretConfigured) {
      throw new Error('微信小程序 AppID 或 AppSecret 尚未配置');
    }
    const session = await createWechatLoginSessionApi();
    sessionId.value = session.id;
    qrCodeDataUrl.value = session.qrCodeDataUrl;
    qrStatus.value = '请使用微信扫描二维码';
    pollTimer = setInterval(() => void pollSession(), 1500);
    pollActive.value = true;
  } catch (error) {
    qrStatus.value = error instanceof Error ? error.message : '二维码生成失败';
    message.error(qrStatus.value);
  } finally {
    qrLoading.value = false;
  }
}

function closeWechatLogin() {
  stopPolling();
  qrOpen.value = false;
}

onBeforeUnmount(stopPolling);
</script>

<template>
  <div>
    <AuthenticationLogin
      :form-schema="formSchema"
      :loading="authStore.loginLoading"
      :show-code-login="false"
      :show-forget-password="false"
      :show-qrcode-login="false"
      :show-register="false"
      :show-third-party-login="false"
      sub-title="请输入您的账户信息开始管理您的店铺"
      @submit="authStore.authLogin"
    />
    <a-divider plain>或</a-divider>
    <a-button class="w-full" size="large" @click="openWechatLogin">
      <template #icon><SvgWeChatIcon class="size-5" /></template>
      微信小程序扫码登录
    </a-button>

    <a-modal
      v-model:open="qrOpen"
      :footer="null"
      title="微信小程序扫码登录"
      width="360px"
      @cancel="closeWechatLogin"
    >
      <div class="wechat-login-panel">
        <a-spin :spinning="qrLoading">
          <img
            v-if="qrCodeDataUrl"
            class="wechat-qr"
            :src="qrCodeDataUrl"
            alt="微信小程序登录二维码"
          />
          <div v-else class="wechat-qr-placeholder">二维码不可用</div>
        </a-spin>
        <p class="wechat-status">{{ qrStatus }}</p>
        <a-button
          v-if="!qrLoading && !pollActive"
          type="link"
          @click="openWechatLogin"
        >
          重新获取
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.wechat-login-panel {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.wechat-qr,
.wechat-qr-placeholder {
  width: 240px;
  height: 240px;
}

.wechat-qr {
  display: block;
}

.wechat-qr-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed hsl(var(--border));
  color: hsl(var(--muted-foreground));
}

.wechat-status {
  margin: 16px 0 0;
  color: hsl(var(--muted-foreground));
  text-align: center;
}
</style>
