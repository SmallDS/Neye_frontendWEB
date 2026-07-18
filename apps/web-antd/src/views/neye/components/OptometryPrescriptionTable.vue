<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import {
  adjustOptometryValue,
  getOptometryQuickInputConfig,
  nextOptometryGridPosition,
} from '../optometry-quick-input';
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

interface ActiveQuickInput {
  fieldKey: string;
  inputKey: string;
  values: string[];
}

const props = withDefaults(
  defineProps<{
    editable?: boolean;
    mode?: 'form' | 'style' | 'view';
    modelValue?: null | Record<string, unknown>;
    styleConfig?: null | OptometryStyleConfig;
  }>(),
  {
    editable: false,
    mode: 'view',
    modelValue: () => ({}),
    styleConfig: () => defaultOptometryStyle,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>];
  toggleExtra: [fieldKey: string];
  toggleRemark: [];
  toggleValueField: [suffix: OptometrySuffix];
}>();

const tableRoot = ref<HTMLElement>();
const activeQuickInput = ref<ActiveQuickInput>();
const activeInputElement = ref<HTMLInputElement>();
const quickBarStyle = ref<Record<string, string>>({});
let blurTimer: number | undefined;

const currentStyle = computed(() =>
  normalizeOptometryStyle(props.styleConfig),
);
const valueModel = computed(() => props.modelValue ?? {});
const isStyleMode = computed(() => props.mode === 'style');
const visibleValueFields = computed(() =>
  optometryValueFields.filter(
    (field) =>
      isStyleMode.value ||
      !currentStyle.value.hiddenValueFields.includes(field.suffix),
  ),
);
const visibleExtraFields = computed(() =>
  optometryExtraFields.filter(
    (field) =>
      isStyleMode.value ||
      !currentStyle.value.hiddenExtraFields.includes(field.key),
  ),
);
const hasAnyVisibleData = computed(() => {
  for (const row of optometryRows) {
    for (const field of visibleValueFields.value) {
      if (
        hasTextValue(
          valueModel.value[optometryFieldName(row.group, field.suffix)],
        )
      ) {
        return true;
      }
    }
  }
  return (
    visibleExtraFields.value.some((field) =>
      hasTextValue(valueModel.value[field.key]),
    ) ||
    (currentStyle.value.showRemark && hasTextValue(valueModel.value.remark))
  );
});
const quickBarVisible = computed(
  () => Boolean(activeQuickInput.value?.values.length),
);

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

function clearBlurTimer() {
  if (blurTimer !== undefined) {
    window.clearTimeout(blurTimer);
    blurTimer = undefined;
  }
}

function updateQuickBarPosition() {
  const input = activeInputElement.value;
  const active = activeQuickInput.value;
  if (!input || !active?.values.length) return;

  const rect = input.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const preferredWidth = Math.min(
    520,
    Math.max(280, active.values.length * 68),
    viewportWidth - 24,
  );
  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - preferredWidth / 2),
    viewportWidth - preferredWidth - 12,
  );
  const top = rect.top >= 60 ? rect.top - 52 : rect.bottom + 8;
  quickBarStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${Math.round(preferredWidth)}px`,
  };
}

function openQuickInput(
  fieldKey: string,
  inputKey: string,
  event: FocusEvent,
) {
  clearBlurTimer();
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const config = getOptometryQuickInputConfig(fieldKey);
  activeInputElement.value = target;
  activeQuickInput.value = {
    fieldKey,
    inputKey,
    values: config?.values ?? [],
  };
  void nextTick(updateQuickBarPosition);
}

function closeQuickInputLater() {
  clearBlurTimer();
  blurTimer = window.setTimeout(() => {
    activeQuickInput.value = undefined;
    activeInputElement.value = undefined;
  }, 140);
}

function keepQuickInputOpen() {
  clearBlurTimer();
}

function applyPreset(value: string) {
  clearBlurTimer();
  const active = activeQuickInput.value;
  if (!active) return;
  updateField(active.inputKey, value);
  void nextTick(() => {
    activeInputElement.value?.focus();
    updateQuickBarPosition();
  });
}

function handlePresetWheel(event: WheelEvent) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  target.scrollLeft += event.deltaY || event.deltaX;
}

function cyclePreset(fieldKey: string, inputKey: string, direction: -1 | 1) {
  const values = getOptometryQuickInputConfig(fieldKey)?.values ?? [];
  if (values.length === 0) return false;
  const current = String(valueModel.value[inputKey] ?? '');
  const currentIndex = values.indexOf(current);
  const nextIndex =
    currentIndex < 0
      ? direction > 0
        ? 0
        : values.length - 1
      : (currentIndex + direction + values.length) % values.length;
  updateField(inputKey, values[nextIndex]);
  return true;
}

function adjustField(
  fieldKey: string,
  inputKey: string,
  direction: -1 | 1,
  adjustment: 'coarse' | 'fine',
) {
  const config = getOptometryQuickInputConfig(fieldKey);
  const step = adjustment === 'coarse' ? config?.coarseStep : config?.fineStep;
  if (step === undefined) return cyclePreset(fieldKey, inputKey, direction);
  updateField(
    inputKey,
    adjustOptometryValue(
      fieldKey,
      valueModel.value[inputKey],
      direction,
      adjustment,
    ),
  );
  return true;
}

function focusInput(inputKey: string) {
  void nextTick(() => {
    const input = tableRoot.value?.querySelector<HTMLInputElement>(
      `input[data-optometry-key="${inputKey}"]`,
    );
    input?.focus();
    input?.select();
  });
}

function focusGridCell(rowIndex: number, columnIndex: number) {
  const row = optometryRows[rowIndex];
  const field = visibleValueFields.value[columnIndex];
  if (!row || !field) return;
  focusInput(optometryFieldName(row.group, field.suffix));
}

function handleValueKeydown(
  event: KeyboardEvent,
  rowIndex: number,
  columnIndex: number,
  fieldKey: string,
  inputKey: string,
) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (
      adjustField(
        fieldKey,
        inputKey,
        event.key === 'ArrowRight' ? 1 : -1,
        'coarse',
      )
    ) {
      event.preventDefault();
    }
    return;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (
      adjustField(
        fieldKey,
        inputKey,
        event.key === 'ArrowUp' ? 1 : -1,
        'fine',
      )
    ) {
      event.preventDefault();
    }
    return;
  }

  if (event.key !== 'Tab' && event.key !== 'Enter') return;
  event.preventDefault();
  const movement =
    event.key === 'Tab'
      ? event.shiftKey
        ? 'left'
        : 'right'
      : event.shiftKey
        ? 'up'
        : 'down';
  const next = nextOptometryGridPosition(
    rowIndex,
    columnIndex,
    optometryRows.length,
    visibleValueFields.value.length,
    movement,
  );
  focusGridCell(next.rowIndex, next.columnIndex);
}

function focusExtraField(index: number) {
  const fields = visibleExtraFields.value;
  if (fields.length === 0) return;
  const normalizedIndex = (index + fields.length) % fields.length;
  const field = fields[normalizedIndex];
  if (field) focusInput(field.key);
}

function handleExtraKeydown(
  event: KeyboardEvent,
  fieldKey: string,
  index: number,
) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (
      adjustField(
        fieldKey,
        fieldKey,
        event.key === 'ArrowRight' ? 1 : -1,
        'coarse',
      )
    ) {
      event.preventDefault();
    }
    return;
  }
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (
      adjustField(
        fieldKey,
        fieldKey,
        event.key === 'ArrowUp' ? 1 : -1,
        'fine',
      )
    ) {
      event.preventDefault();
    }
    return;
  }
  if (event.key !== 'Tab' && event.key !== 'Enter') return;
  event.preventDefault();
  focusExtraField(index + (event.shiftKey ? -1 : 1));
}

onMounted(() => {
  window.addEventListener('resize', updateQuickBarPosition);
  window.addEventListener('scroll', updateQuickBarPosition, true);
});

onBeforeUnmount(() => {
  clearBlurTimer();
  window.removeEventListener('resize', updateQuickBarPosition);
  window.removeEventListener('scroll', updateQuickBarPosition, true);
});
</script>

<template>
  <div ref="tableRoot" class="neye-prescription-scroll">
    <table
      class="neye-prescription-table"
      :class="{ 'neye-prescription-table--form': editable || isStyleMode }"
    >
      <thead>
        <tr>
          <th class="neye-prescription-eye-head" colspan="2"></th>
          <th
            v-for="field in visibleValueFields"
            :key="field.suffix"
            :class="{
              'neye-prescription-column-hidden':
                isStyleMode && isValueFieldHidden(field.suffix),
            }"
          >
            <div class="neye-prescription-head-main">{{ field.label }}</div>
            <div class="neye-prescription-head-sub">{{ field.shortLabel }}</div>
            <a-checkbox
              v-if="isStyleMode"
              class="neye-prescription-column-check"
              :checked="!isValueFieldHidden(field.suffix)"
              @change="emit('toggleValueField', field.suffix)"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in optometryRows" :key="row.group">
          <th
            v-if="row.showPurpose"
            class="neye-prescription-purpose"
            rowspan="2"
          >
            {{ row.purpose }}
          </th>
          <th class="neye-prescription-eye">{{ row.eye }}</th>
          <td
            v-for="(field, columnIndex) in visibleValueFields"
            :key="field.suffix"
            class="neye-prescription-cell-input"
            :class="{
              'neye-prescription-column-hidden':
                isStyleMode && isValueFieldHidden(field.suffix),
            }"
          >
            <a-input
              v-if="editable"
              :data-optometry-key="optometryFieldName(row.group, field.suffix)"
              :value="valueModel[optometryFieldName(row.group, field.suffix)]"
              autocomplete="off"
              @blur="closeQuickInputLater"
              @focus="(event: FocusEvent) => openQuickInput(field.suffix, optometryFieldName(row.group, field.suffix), event)"
              @keydown="(event: KeyboardEvent) => handleValueKeydown(event, rowIndex, columnIndex, field.suffix, optometryFieldName(row.group, field.suffix))"
              @update:value="(value: unknown) => updateField(optometryFieldName(row.group, field.suffix), value)"
            />
            <span v-else class="neye-prescription-value">
              {{ displayValue(valueModel[optometryFieldName(row.group, field.suffix)]) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <div
      class="neye-prescription-extra"
      :class="{ 'neye-prescription-extra--form': editable || isStyleMode }"
    >
      <template v-for="(field, index) in visibleExtraFields" :key="field.key">
        <div
          class="neye-prescription-extra-label"
          :class="{
            'neye-prescription-column-hidden':
              isStyleMode && isExtraHidden(field.key),
          }"
        >
          {{ field.compactLabel }}:
        </div>
        <div
          class="neye-prescription-extra-value"
          :class="{
            'neye-prescription-column-hidden':
              isStyleMode && isExtraHidden(field.key),
          }"
        >
          <template v-if="isStyleMode">
            <a-checkbox
              :checked="!isExtraHidden(field.key)"
              @change="emit('toggleExtra', field.key)"
            >
              显示
            </a-checkbox>
          </template>
          <a-input
            v-else-if="editable"
            :data-optometry-key="field.key"
            :value="valueModel[field.key]"
            autocomplete="off"
            @blur="closeQuickInputLater"
            @focus="(event: FocusEvent) => openQuickInput(field.key, field.key, event)"
            @keydown="(event: KeyboardEvent) => handleExtraKeydown(event, field.key, index)"
            @update:value="(value: unknown) => updateField(field.key, value)"
          />
          <span v-else class="neye-prescription-value">
            {{ displayValue(valueModel[field.key]) }}
          </span>
        </div>
      </template>
    </div>

    <div
      v-if="isStyleMode || currentStyle.showRemark"
      class="neye-prescription-remark"
      :class="{
        'neye-prescription-remark--form': editable || isStyleMode,
      }"
    >
      <div class="neye-prescription-remark-label">备注</div>
      <div
        class="neye-prescription-remark-value"
        :class="{
          'neye-prescription-column-hidden':
            isStyleMode && !currentStyle.showRemark,
        }"
      >
        <template v-if="isStyleMode">
          <a-checkbox
            :checked="currentStyle.showRemark"
            @change="emit('toggleRemark')"
          >
            显示备注
          </a-checkbox>
        </template>
        <a-textarea
          v-else-if="editable"
          :value="valueModel.remark"
          :rows="2"
          @update:value="(value: unknown) => updateField('remark', value)"
        />
        <span v-else>{{ displayValue(valueModel.remark) }}</span>
      </div>
    </div>

    <p
      v-if="!editable && !isStyleMode && !hasAnyVisibleData"
      class="neye-empty-text neye-prescription-empty"
    >
      暂无验光数据
    </p>
  </div>

  <Teleport to="body">
    <div
      v-if="quickBarVisible"
      class="neye-optometry-quick-bar"
      :style="quickBarStyle"
      @mousedown.prevent="keepQuickInputOpen"
      @wheel.prevent="handlePresetWheel"
    >
      <button
        v-for="value in activeQuickInput?.values || []"
        :key="value"
        type="button"
        class="neye-optometry-quick-value"
        :class="{
          active:
            String(valueModel[activeQuickInput?.inputKey || ''] ?? '') === value,
        }"
        @mousedown.prevent.stop="applyPreset(value)"
      >
        {{ value }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.neye-optometry-quick-bar {
  position: fixed;
  z-index: 1080;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--popover));
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  scrollbar-width: thin;
}
.neye-optometry-quick-value {
  flex: 0 0 auto;
  min-width: 54px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 5px;
  background: hsl(var(--muted) / 0.65);
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 13px;
  text-align: center;
  white-space: nowrap;
}
.neye-optometry-quick-value:hover {
  background: hsl(var(--muted));
}
.neye-optometry-quick-value.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
</style>