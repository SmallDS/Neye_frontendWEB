<script setup lang="ts">
defineOptions({ name: 'NEyeFittingDetail' });

import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useRoute, useRouter } from 'vue-router';

import { apiRequest } from '#/api/neye';
import type { FittingOrder } from '#/types/neye';

import { customerWorkspaceLocation } from '../customer-workspace';

const route = useRoute();
const router = useRouter();
const failed = ref(false);

onMounted(async () => {
  try {
    const order = await apiRequest<FittingOrder>(
      `/fitting-orders/${String(route.params.id)}`,
    );
    await router.replace(
      customerWorkspaceLocation(
        order.customerId,
        order.optometryOrderId,
        order.id,
      ),
    );
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
        title="配镜单加载失败"
        sub-title="请返回配镜单列表重新选择"
      >
        <template #extra>
          <a-button type="primary" @click="router.replace('/neye/fitting-orders')">返回列表</a-button>
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
  min-height: 320px;
  place-items: center;
}
</style>