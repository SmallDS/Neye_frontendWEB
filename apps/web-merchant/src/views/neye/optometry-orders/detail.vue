<script setup lang="ts">
import type { OptometryOrder } from '#/types/neye';

import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { message } from 'ant-design-vue';

import { apiRequest } from '#/api/neye';
import { useNeyePermissions } from '#/composables/useNeyePermissions';

import { customerWorkspaceLocation } from '../customer-workspace';

defineOptions({ name: 'NEyeOptometryDetail' });

const route = useRoute();
const router = useRouter();
const failed = ref(false);
const { can } = useNeyePermissions();

onMounted(async () => {
  if (!can('optometry.read')) {
    failed.value = true;
    message.warning('当前账号没有查看验光单的权限，请联系管理员');
    return;
  }
  try {
    const order = await apiRequest<OptometryOrder>(
      `/optometry-orders/${String(route.params.id)}`,
    );
    await router.replace(customerWorkspaceLocation(order.customerId, order.id));
  } catch (error) {
    failed.value = true;
    message.error(error instanceof Error ? error.message : '加载失败');
  }
});
</script>

<template>
  <div class="neye-page">
    <section class="neye-panel neye-legacy-redirect">
      <a-result
        v-if="failed"
        status="error"
        title="验光单加载失败"
        sub-title="请返回验光单列表重新选择"
      >
        <template #extra>
          <a-button
            type="primary"
            @click="router.replace('/neye/optometry-orders')"
          >
            返回列表
          </a-button>
        </template>
      </a-result>
      <a-spin v-else size="large" tip="正在进入客户档案" />
    </section>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.neye-legacy-redirect {
  display: grid;
  place-items: center;
  min-height: 320px;
}
</style>
