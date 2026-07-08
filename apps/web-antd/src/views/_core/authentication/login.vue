<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';

import { useAuthStore } from '#/store';

const authStore = useAuthStore();

const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: {
      placeholder: 'admin',
    },
    defaultValue: 'admin',
    fieldName: 'username',
    label: 'Username',
    rules: z.string().min(1, { message: 'Username is required' }),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      placeholder: 'Admin123456',
    },
    defaultValue: 'Admin123456',
    fieldName: 'password',
    label: 'Password',
    rules: z.string().min(1, { message: 'Password is required' }),
  },
]);
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="authStore.authLogin"
  />
</template>