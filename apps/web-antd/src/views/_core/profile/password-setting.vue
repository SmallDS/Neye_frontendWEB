<script setup lang="ts">
import type { Recordable } from '@vben/types';

import type { VbenFormSchema } from '#/adapter/form';

import { computed } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { changeCurrentPasswordApi } from '#/api';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();

const formSchema = computed((): VbenFormSchema[] => [
  {
    fieldName: 'currentPassword',
    label: '当前密码',
    component: 'VbenInputPassword',
    componentProps: { placeholder: '请输入当前密码' },
    rules: z.string().min(1, '请输入当前密码'),
  },
  {
    fieldName: 'newPassword',
    label: '新密码',
    component: 'VbenInputPassword',
    componentProps: { passwordStrength: true, placeholder: '请输入新密码' },
    rules: z.string().min(8, '新密码至少需要 8 个字符').max(72, '新密码不能超过 72 个字符'),
  },
  {
    fieldName: 'confirmPassword',
    label: '确认新密码',
    component: 'VbenInputPassword',
    componentProps: { placeholder: '请再次输入新密码' },
    dependencies: {
      rules(values) {
        return z
          .string()
          .min(1, '请再次输入新密码')
          .refine((value) => value === values.newPassword, '两次输入的新密码不一致');
      },
      triggerFields: ['newPassword'],
    },
  },
]);

async function handleSubmit(values: Recordable<any>) {
  try {
    await changeCurrentPasswordApi({
      currentPassword: String(values.currentPassword),
      newPassword: String(values.newPassword),
    });
    message.success('密码修改成功，请重新登录');
    await authStore.logout(false);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '密码修改失败');
  }
}
</script>

<template>
  <section class="max-w-2xl">
    <h2 class="mb-1 text-lg font-semibold">修改密码</h2>
    <p class="mb-6 text-sm text-foreground/60">修改成功后会退出当前账号，请使用新密码重新登录。</p>
    <ProfilePasswordSetting :form-schema="formSchema" @submit="handleSubmit" />
  </section>
</template>
