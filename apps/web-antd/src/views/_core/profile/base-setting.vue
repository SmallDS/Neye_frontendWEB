<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { getCurrentUserApi, updateCurrentUserApi } from '#/api';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();
const profileBaseSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => [
  {
    fieldName: 'displayName',
    component: 'Input',
    componentProps: { maxlength: 80, placeholder: '请输入显示名称' },
    label: '显示名称',
    rules: z.string().min(1, '请输入显示名称').max(80, '显示名称不能超过 80 个字符'),
  },
  {
    fieldName: 'username',
    component: 'Input',
    componentProps: { disabled: true },
    label: '登录账号',
  },
  {
    fieldName: 'roleName',
    component: 'Input',
    componentProps: { disabled: true },
    label: '账户角色',
  },
  {
    fieldName: 'tenantName',
    component: 'Input',
    componentProps: { disabled: true },
    label: '所属租户',
  },
]);

async function loadProfile() {
  const user = await getCurrentUserApi();
  await profileBaseSettingRef.value?.getFormApi().setValues({
    displayName: user.displayName,
    roleName: user.role === 'admin' ? '系统管理员' : '店员',
    tenantName: user.tenant?.name ?? '系统级账户',
    username: user.username,
  });
}

async function handleSubmit(values: Recordable<any>) {
  try {
    await updateCurrentUserApi({ displayName: String(values.displayName).trim() });
    await authStore.fetchUserInfo();
    message.success('账户信息已更新');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账户信息更新失败');
  }
}

onMounted(async () => {
  try {
    await loadProfile();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '账户信息加载失败');
  }
});
</script>

<template>
  <section class="max-w-2xl">
    <h2 class="mb-1 text-lg font-semibold">账户信息</h2>
    <p class="mb-6 text-sm text-foreground/60">登录账号、角色和所属租户由管理员维护。</p>
    <ProfileBaseSetting
      ref="profileBaseSettingRef"
      :form-schema="formSchema"
      @submit="handleSubmit"
    />
  </section>
</template>
