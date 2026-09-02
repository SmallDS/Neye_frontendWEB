<script setup lang="ts">
import type { ImportTask } from '#/types/neye';

import { ref, watch } from 'vue';

import { importDangerDescription } from '../../governance';

type ImportDangerKind = 'cancel' | 'delete' | 'rollback';

interface DangerAction {
  kind: ImportDangerKind;
  task: ImportTask;
  title: string;
}

const props = defineProps<{
  action?: DangerAction;
  loading: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  confirm: [confirmation: string];
  'update:open': [open: boolean];
}>();

const confirmation = ref('');

watch([() => props.open, () => props.action], () => {
  confirmation.value = '';
});
</script>

<template>
  <a-modal
    :open="open"
    :title="action?.title"
    :footer="null"
    destroy-on-close
    @update:open="emit('update:open', $event)"
  >
    <a-alert
      type="warning"
      show-icon
      :message="action?.title"
      :description="importDangerDescription(action?.kind)"
      style="margin-bottom: 16px"
    />
    <a-form
      layout="vertical"
      :model="{ confirmation }"
      @finish="emit('confirm', confirmation)"
    >
      <a-form-item
        :label="`请输入文件名“${action?.task.fileName || ''}”完成确认`"
        name="confirmation"
        :rules="[{ required: true, message: '请输入文件名' }]"
      >
        <a-input v-model:value="confirmation" autocomplete="off" />
      </a-form-item>
      <a-space>
        <a-button
          :danger="action?.kind !== 'cancel'"
          type="primary"
          html-type="submit"
          :loading="loading"
        >
          确认执行
        </a-button>
        <a-button @click="emit('update:open', false)">返回</a-button>
      </a-space>
    </a-form>
  </a-modal>
</template>
