<script setup lang="ts">
defineOptions({ name: 'NEyeOptometryStyle' });
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { apiRequest } from '#/api/neye';
import OptometryPrescriptionTable from '../components/OptometryPrescriptionTable.vue';
import { defaultOptometryStyle, normalizeOptometryStyle, type OptometryStyleConfig, type OptometrySuffix } from '../optometry-prescription';

const loading = ref(false);
const saving = ref(false);
const styleConfig = ref<OptometryStyleConfig>({ ...defaultOptometryStyle });
const previewData = computed(() => ({
  farRightSph: '-1.00',
  farRightCyl: '-0.50',
  farRightAxis: '180',
  farRightBcV: '8.6',
  farRightBcH: '8.4',
  farRightDia: '14.2',
  farLeftSph: '-1.25',
  farLeftCyl: '-0.75',
  farLeftAxis: '175',
  farLeftBcV: '8.6',
  farLeftBcH: '8.4',
  farLeftDia: '14.2',
  nearRightAdd: '+1.00',
  nearLeftAdd: '+1.00',
  farPd: '62',
  farRightPd: '31',
  farLeftPd: '31',
  nearPd: '58',
  rightHeight: '18',
  leftHeight: '18',
  remark: '样式预览备注',
}));

async function load() {
  loading.value = true;
  try {
    styleConfig.value = normalizeOptometryStyle(await apiRequest<Partial<OptometryStyleConfig>>('/system-settings/optometry-style'));
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

function toggleValueField(suffix: OptometrySuffix) {
  const hidden = new Set(styleConfig.value.hiddenValueFields);
  if (hidden.has(suffix)) hidden.delete(suffix);
  else hidden.add(suffix);
  styleConfig.value = { ...styleConfig.value, hiddenValueFields: [...hidden] };
}

function toggleExtra(fieldKey: string) {
  const hidden = new Set(styleConfig.value.hiddenExtraFields);
  if (hidden.has(fieldKey)) hidden.delete(fieldKey);
  else hidden.add(fieldKey);
  styleConfig.value = { ...styleConfig.value, hiddenExtraFields: [...hidden] };
}

function toggleRemark() {
  styleConfig.value = { ...styleConfig.value, showRemark: !styleConfig.value.showRemark };
}

function resetAllVisible() {
  styleConfig.value = { ...defaultOptometryStyle };
}

async function save() {
  saving.value = true;
  try {
    styleConfig.value = normalizeOptometryStyle(await apiRequest<OptometryStyleConfig>('/system-settings/optometry-style', { method: 'PATCH', body: JSON.stringify({ value: styleConfig.value }) }));
    message.success('验光单样式已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">验光单样式</h1>
        <p class="neye-page-subtitle">勾选要保留的字段列。取消“基弧V”这类字段后，整列会从验光单中移除，表格自动拉伸重排。</p>
      </div>
      <a-space>
        <a-button @click="resetAllVisible">全部显示</a-button>
        <a-button type="primary" :loading="saving" @click="save">保存样式</a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <section class="neye-panel" style="margin-bottom: 14px">
        <h2 class="neye-section-title">可视化编辑</h2>
        <OptometryPrescriptionTable
          mode="style"
          :model-value="previewData"
          :style-config="styleConfig"
          @toggle-value-field="toggleValueField"
          @toggle-extra="toggleExtra"
          @toggle-remark="toggleRemark"
        />
      </section>

      <section class="neye-panel">
        <h2 class="neye-section-title">效果预览</h2>
        <OptometryPrescriptionTable mode="view" :model-value="previewData" :style-config="styleConfig" />
      </section>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>