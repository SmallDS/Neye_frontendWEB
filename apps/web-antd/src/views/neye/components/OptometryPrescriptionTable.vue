<script setup lang="ts">
import { computed } from 'vue';
import {
  defaultOptometryStyle,
  hasTextValue,
  normalizeOptometryStyle,
  optometryExtraFields,
  optometryFieldName,
  optometryRows,
  optometryValueFields,
  type OptometryStyleConfig,
  type OptometrySuffix,
} from '../optometry-prescription';

const props = withDefaults(defineProps<{
  editable?: boolean;
  mode?: 'form' | 'style' | 'view';
  modelValue?: Record<string, unknown> | null;
  styleConfig?: OptometryStyleConfig | null;
}>(), {
  editable: false,
  mode: 'view',
  modelValue: () => ({}),
  styleConfig: () => defaultOptometryStyle,
});

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
  toggleValueField: [suffix: OptometrySuffix];
  toggleExtra: [fieldKey: string];
  toggleRemark: [];
}>();

const currentStyle = computed(() => normalizeOptometryStyle(props.styleConfig));
const valueModel = computed(() => props.modelValue ?? {});
const isStyleMode = computed(() => props.mode === 'style');
const visibleValueFields = computed(() => optometryValueFields.filter((field) => isStyleMode.value || !currentStyle.value.hiddenValueFields.includes(field.suffix)));
const visibleExtraFields = computed(() => optometryExtraFields.filter((field) => isStyleMode.value || !currentStyle.value.hiddenExtraFields.includes(field.key)));
const hasAnyVisibleData = computed(() => {
  for (const row of optometryRows) {
    for (const field of visibleValueFields.value) {
      if (hasTextValue(valueModel.value[optometryFieldName(row.group, field.suffix)])) return true;
    }
  }
  return visibleExtraFields.value.some((field) => hasTextValue(valueModel.value[field.key])) || (currentStyle.value.showRemark && hasTextValue(valueModel.value.remark));
});

function displayValue(value: unknown) {
  return hasTextValue(value) ? String(value) : '';
}

function updateField(key: string, value: unknown) {
  emit('update:modelValue', { ...valueModel.value, [key]: value });
}

function isValueFieldHidden(suffix: OptometrySuffix) {
  return currentStyle.value.hiddenValueFields.includes(suffix);
}

function isExtraHidden(key: string) {
  return currentStyle.value.hiddenExtraFields.includes(key);
}
</script>

<template>
  <div class="neye-prescription-scroll">
    <table class="neye-prescription-table" :class="{ 'neye-prescription-table--form': editable || isStyleMode }">
      <thead>
        <tr>
          <th class="neye-prescription-eye-head" colspan="2"></th>
          <th
            v-for="field in visibleValueFields"
            :key="field.suffix"
            :class="{ 'neye-prescription-column-hidden': isStyleMode && isValueFieldHidden(field.suffix) }"
          >
            <div class="neye-prescription-head-main">{{ field.label }}</div>
            <div class="neye-prescription-head-sub">{{ field.shortLabel }}</div>
            <a-checkbox v-if="isStyleMode" class="neye-prescription-column-check" :checked="!isValueFieldHidden(field.suffix)" @change="emit('toggleValueField', field.suffix)" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in optometryRows" :key="row.group">
          <th v-if="row.showPurpose" class="neye-prescription-purpose" rowspan="2">{{ row.purpose }}</th>
          <th class="neye-prescription-eye">{{ row.eye }}</th>
          <td
            v-for="field in visibleValueFields"
            :key="field.suffix"
            class="neye-prescription-cell-input"
            :class="{ 'neye-prescription-column-hidden': isStyleMode && isValueFieldHidden(field.suffix) }"
          >
            <a-input v-if="editable" :value="valueModel[optometryFieldName(row.group, field.suffix)]" @update:value="(value: unknown) => updateField(optometryFieldName(row.group, field.suffix), value)" />
            <span v-else class="neye-prescription-value">{{ displayValue(valueModel[optometryFieldName(row.group, field.suffix)]) }}</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="neye-prescription-extra" :class="{ 'neye-prescription-extra--form': editable || isStyleMode }">
      <template v-for="field in visibleExtraFields" :key="field.key">
        <div class="neye-prescription-extra-label" :class="{ 'neye-prescription-column-hidden': isStyleMode && isExtraHidden(field.key) }">{{ field.compactLabel }}:</div>
        <div class="neye-prescription-extra-value" :class="{ 'neye-prescription-column-hidden': isStyleMode && isExtraHidden(field.key) }">
          <template v-if="isStyleMode">
            <a-checkbox :checked="!isExtraHidden(field.key)" @change="emit('toggleExtra', field.key)">显示</a-checkbox>
          </template>
          <a-input v-else-if="editable" :value="valueModel[field.key]" @update:value="(value: unknown) => updateField(field.key, value)" />
          <span v-else class="neye-prescription-value">{{ displayValue(valueModel[field.key]) }}</span>
        </div>
      </template>
    </div>

    <div v-if="isStyleMode || currentStyle.showRemark" class="neye-prescription-remark" :class="{ 'neye-prescription-remark--form': editable || isStyleMode }">
      <div class="neye-prescription-remark-label">备注</div>
      <div class="neye-prescription-remark-value" :class="{ 'neye-prescription-column-hidden': isStyleMode && !currentStyle.showRemark }">
        <template v-if="isStyleMode">
          <a-checkbox :checked="currentStyle.showRemark" @change="emit('toggleRemark')">显示备注</a-checkbox>
        </template>
        <a-textarea v-else-if="editable" :value="valueModel.remark" :rows="2" @update:value="(value: unknown) => updateField('remark', value)" />
        <span v-else>{{ displayValue(valueModel.remark) }}</span>
      </div>
    </div>

    <p v-if="!editable && !isStyleMode && !hasAnyVisibleData" class="neye-empty-text neye-prescription-empty">暂无验光数据</p>
  </div>
</template>