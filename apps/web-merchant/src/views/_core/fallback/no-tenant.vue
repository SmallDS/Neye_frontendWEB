<script lang="ts" setup>
import { useAuthStore } from '#/store';

const authStore = useAuthStore();
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center p-6">
    <a-result
      status="warning"
      title="暂时没有可用门店"
      sub-title="当前商家账号尚未分配可用门店，请联系平台管理员处理。"
    >
      <template #extra>
        <a-button type="primary" @click="authStore.logout()">
          返回登录
        </a-button>
      </template>
    </a-result>
  </div>
</template>
