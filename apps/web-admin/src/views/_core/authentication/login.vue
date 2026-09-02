<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';

import { getLoginErrorMessage } from '#/api/neye';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();
const loginError = ref('');

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: { placeholder: '请输入管理员账号' },
    fieldName: 'username',
    label: '管理员账号',
    rules: z.string().min(1, { message: '请输入管理员账号' }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: { placeholder: '请输入密码' },
    fieldName: 'password',
    label: '密码',
    rules: z.string().min(1, { message: '请输入密码' }),
  },
]);

async function handleLogin(values: Recordable<any>) {
  loginError.value = '';
  try {
    await authStore.authLogin(values);
  } catch (error) {
    loginError.value = getLoginErrorMessage(error);
  }
}
</script>

<template>
  <div>
    <a-alert
      v-if="loginError"
      class="mb-4"
      closable
      show-icon
      type="error"
      :message="loginError"
      @close="loginError = ''"
    />
    <AuthenticationLogin
      :form-schema="formSchema"
      :loading="authStore.loginLoading"
      :show-code-login="false"
      :show-forget-password="false"
      :show-qrcode-login="false"
      :show-register="false"
      :show-third-party-login="false"
      sub-title="仅限 NEye 平台管理员登录"
      @submit="handleLogin"
    />
  </div>
</template>
