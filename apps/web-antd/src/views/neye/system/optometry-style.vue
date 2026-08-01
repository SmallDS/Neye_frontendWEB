<script setup lang="ts">
defineOptions({ name: 'NEyeOptometryStyle' });

import { computed, onMounted, ref, watch } from 'vue';

import { message } from 'ant-design-vue';

import { apiRequest } from '#/api/neye';
import { useNeyeTenantScope } from '#/composables/useNeyeTenantScope';

import OptometryPrescriptionTable from '../components/OptometryPrescriptionTable.vue';
import {
  defaultOptometryStyle,
  normalizeOptometryStyle,
  showAllOptometryStyle,
  type OptometryStyleConfig,
  type OptometrySuffix,
} from '../optometry-prescription';

const loading = ref(false);
const saving = ref(false);
const styleConfig = ref<OptometryStyleConfig>({ ...defaultOptometryStyle });
const {
  isAdmin,
  isTenantSelectorVisible,
  loadTenants,
  scopedTenantId,
  selectedTenant,
  selectedTenantId,
  tenantLoading,
  tenantOptions,
} = useNeyeTenantScope({ forceTenantSelector: true });
const showTenantSelector = computed(
  () => isAdmin.value || isTenantSelectorVisible.value,
);
const selectedTenantLabel = computed(() =>
  selectedTenant.value
    ? `${selectedTenant.value.name} / ${selectedTenant.value.code}`
    : '未选择门店',
);
let loadVersion = 0;
let tenantScopeReady = false;

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
  const tenantId = scopedTenantId.value;
  const version = ++loadVersion;
  if (!tenantId) {
    loading.value = false;
    styleConfig.value = { ...defaultOptometryStyle };
    return;
  }

  loading.value = true;
  try {
    const params = new URLSearchParams({ tenantId });
    const loadedStyle = await apiRequest<Partial<OptometryStyleConfig>>(
      `/system-settings/optometry-style?${params}`,
    );
    if (version === loadVersion && tenantId === scopedTenantId.value) {
      styleConfig.value = normalizeOptometryStyle(loadedStyle);
    }
  } catch (error) {
    if (version === loadVersion) {
      message.error(error instanceof Error ? error.message : '加载失败');
    }
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}

function tenantFilterOption(input: string, option?: { label?: string }) {
  return String(option?.label ?? '')
    .toLowerCase()
    .includes(input.toLowerCase());
}

function toggleValueField(suffix: OptometrySuffix) {
  const hidden = new Set(styleConfig.value.hiddenValueFields);
  if (hidden.has(suffix)) hidden.delete(suffix);
  else hidden.add(suffix);
  styleConfig.value = {
    ...styleConfig.value,
    hiddenValueFields: [...hidden],
  };
}

function toggleExtra(fieldKey: string) {
  const hidden = new Set(styleConfig.value.hiddenExtraFields);
  if (hidden.has(fieldKey)) hidden.delete(fieldKey);
  else hidden.add(fieldKey);
  styleConfig.value = {
    ...styleConfig.value,
    hiddenExtraFields: [...hidden],
  };
}

function toggleRemark() {
  styleConfig.value = {
    ...styleConfig.value,
    showRemark: !styleConfig.value.showRemark,
  };
}

function updateValueFieldOrder(valueFieldOrder: OptometrySuffix[]) {
  styleConfig.value = { ...styleConfig.value, valueFieldOrder };
}

function updateExtraFieldOrder(extraFieldOrder: string[]) {
  styleConfig.value = { ...styleConfig.value, extraFieldOrder };
}

function resetAllVisible() {
  styleConfig.value = showAllOptometryStyle(styleConfig.value);
}

async function save() {
  const tenantId = scopedTenantId.value;
  if (!tenantId) return;

  saving.value = true;
  try {
    const savedStyle = await apiRequest<OptometryStyleConfig>(
      '/system-settings/optometry-style',
      {
        body: JSON.stringify({ tenantId, value: styleConfig.value }),
        method: 'PATCH',
      },
    );
    if (tenantId === scopedTenantId.value) {
      styleConfig.value = normalizeOptometryStyle(savedStyle);
    }
    message.success('验光单样式已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

watch(scopedTenantId, (tenantId, previousTenantId) => {
  if (!tenantScopeReady || tenantId === previousTenantId) return;
  styleConfig.value = { ...defaultOptometryStyle };
  void load();
});

onMounted(async () => {
  try {
    await loadTenants(false, !isAdmin.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '门店加载失败');
  } finally {
    tenantScopeReady = true;
    await load();
  }
});
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">验光单样式</h1>
        <p class="neye-page-subtitle">
          样式按门店保存，并实时应用于该门店的新旧验光单。
        </p>
      </div>
      <a-space>
        <a-button @click="resetAllVisible">全部显示</a-button>
        <a-button
          type="primary"
          :disabled="!scopedTenantId"
          :loading="saving"
          @click="save"
        >
          保存样式
        </a-button>
      </a-space>
    </div>

    <section class="neye-panel" style="margin-bottom: 14px">
      <div class="neye-section-head">
        <div>
          <h2 class="neye-section-title">当前门店</h2>
          <p class="neye-page-subtitle">
            每家门店独立维护验光单字段的显示方式。
          </p>
        </div>
        <a-select
          v-if="showTenantSelector"
          v-model:value="selectedTenantId"
          show-search
          :allow-clear="isAdmin"
          :filter-option="tenantFilterOption"
          :loading="tenantLoading"
          :options="tenantOptions"
          placeholder="请选择门店"
          style="min-width: 260px"
        />
        <a-tag v-else color="blue">{{ selectedTenantLabel }}</a-tag>
      </div>
      <a-alert
        v-if="!scopedTenantId"
        message="请先选择门店，再编辑并保存验光单样式。"
        type="info"
        show-icon
      />
    </section>

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
          @update-extra-field-order="updateExtraFieldOrder"
          @update-value-field-order="updateValueFieldOrder"
        />
      </section>

      <section class="neye-panel">
        <h2 class="neye-section-title">效果预览</h2>
        <OptometryPrescriptionTable
          mode="view"
          :model-value="previewData"
          :style-config="styleConfig"
        />
      </section>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>