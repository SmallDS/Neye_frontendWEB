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
  moveOptometryField,
  normalizeOptometryStyle,
  optometryExtraFields,
  optometryFieldName,
  optometryRows,
  optometryValueFields,
  orderOptometryFields,
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
  updateExtraFieldOrder: [order: string[]];
  updateValueFieldOrder: [order: OptometrySuffix[]];
}>();

const tableRoot = ref<HTMLElement>();
const activeQuickInput = ref<ActiveQuickInput>();
const activeInputElement = ref<HTMLInputElement>();
const quickBarStyle = ref<Record<string, string>>({});
const draggedGroup = ref<'extra' | 'value'>();
const draggedKey = ref<string>();
const dragOverKey = ref<string>();
let blurTimer: number | undefined;

const currentStyle = computed(() =>
  normalizeOptometryStyle(props.styleConfig),
);
const valueModel = computed(() => props.modelValue ?? {});
const isStyleMode = computed(() => props.mode === 'style');
const orderedValueFields = computed(() =>
  orderOptometryFields(
    optometryValueFields,
    currentStyle.value.valueFieldOrder,
    (field) => field.suffix,
  ),
);
const orderedExtraFields = computed(() =>
  orderOptometryFields(
    optometryExtraFields,
    currentStyle.value.extraFieldOrder,
    (field) => field.key,
  ),
);
const visibleValueFields = computed(() =>
  orderedValueFields.value.filter(
    (field) =>
      isStyleMode.value ||
      !currentStyle.value.hiddenValueFields.includes(field.suffix),
  ),
);
const visibleExtraFields = computed(() =>
  orderedExtraFields.value.filter(
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

function sortableItemLabel(
  group: 'extra' | 'value',
  key: string,
  index: number,
  total: number,
) {
  const hidden =
    group === 'value'
      ? isValueFieldHidden(key as OptometrySuffix)
      : isExtraHidden(key);
  return `${hidden ? '已隐藏' : '显示中'}，第 ${index + 1} 项，共 ${total} 项；可拖动或使用左右方向键调整顺序`;
}

function moveSortableItem(
  group: 'extra' | 'value',
  key: string,
  targetIndex: number,
) {
  if (group === 'value') {
    emit(
      'updateValueFieldOrder',
      moveOptometryField(
        currentStyle.value.valueFieldOrder,
        key as OptometrySuffix,
        targetIndex,
      ),
    );
    return;
  }
  emit(
    'updateExtraFieldOrder',
    moveOptometryField(currentStyle.value.extraFieldOrder, key, targetIndex),
  );
}

function handleSortableKeydown(
  event: KeyboardEvent,
  group: 'extra' | 'value',
  key: string,
  index: number,
) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  moveSortableItem(group, key, index + (event.key === 'ArrowLeft' ? -1 : 1));
}

function handleDragStart(
  event: DragEvent,
  group: 'extra' | 'value',
  key: string,
) {
  draggedGroup.value = group;
  draggedKey.value = key;
  dragOverKey.value = key;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  }
}

function handleDragOver(
  event: DragEvent,
  group: 'extra' | 'value',
  key: string,
) {
  if (draggedGroup.value !== group || !draggedKey.value) return;
  event.preventDefault();
  dragOverKey.value = key;
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

function handleDrop(group: 'extra' | 'value', targetKey: string) {
  const dragged = draggedKey.value;
  if (draggedGroup.value !== group || !dragged || dragged === targetKey) {
    finishDrag();
    return;
  }
  const targetIndex =
    group === 'value'
      ? currentStyle.value.valueFieldOrder.indexOf(
          targetKey as OptometrySuffix,
        )
      : currentStyle.value.extraFieldOrder.indexOf(targetKey);
  moveSortableItem(group, dragged, targetIndex);
  finishDrag();
}

function finishDrag() {
  draggedGroup.value = undefined;
  draggedKey.value = undefined;
  dragOverKey.value = undefined;
}

function toggleSortableItem(group: 'extra' | 'value', key: string) {
  if (group === 'value') emit('toggleValueField', key as OptometrySuffix);
  else emit('toggleExtra', key);
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
    <div v-if="isStyleMode" class="neye-field-sorters">
      <p class="neye-field-sorters-hint">
        拖动字段手柄调整显示位置，也可聚焦字段后使用左右方向键，或点击两侧按钮。
      </p>
      <section class="neye-field-sorter-section" aria-labelledby="value-field-order-title">
        <h3 id="value-field-order-title" class="neye-field-sorter-title">
          主字段顺序
        </h3>
        <div class="neye-field-sorter-list" role="list">
          <div
            v-for="(field, index) in orderedValueFields"
            :key="field.suffix"
            class="neye-field-sorter-item"
            :class="{
              'is-dragging': draggedGroup === 'value' && draggedKey === field.suffix,
              'is-drop-target': draggedGroup === 'value' && dragOverKey === field.suffix && draggedKey !== field.suffix,
              'is-hidden': isValueFieldHidden(field.suffix),
            }"
            role="listitem"
            tabindex="0"
            :aria-label="sortableItemLabel('value', field.suffix, index, orderedValueFields.length)"
            @dragover="handleDragOver($event, 'value', field.suffix)"
            @drop.prevent="handleDrop('value', field.suffix)"
            @keydown="handleSortableKeydown($event, 'value', field.suffix, index)"
          >
            <span
              class="neye-field-drag-handle"
              draggable="true"
              :aria-label="`拖动${field.label}`"
              @dragend="finishDrag"
              @dragstart="handleDragStart($event, 'value', field.suffix)"
            >⋮⋮</span>
            <span class="neye-field-sorter-name">{{ field.label }}</span>
            <button
              type="button"
              class="neye-field-visibility"
              :aria-label="`${field.label}${isValueFieldHidden(field.suffix) ? '已隐藏，点击显示' : '显示中，点击隐藏'}`"
              @click.stop="toggleSortableItem('value', field.suffix)"
              @keydown.stop
            >
              {{ isValueFieldHidden(field.suffix) ? '已隐藏' : '显示中' }}
            </button>
            <button
              type="button"
              class="neye-field-move-button"
              :disabled="index === 0"
              :aria-label="`${field.label}左移`"
              @click.stop="moveSortableItem('value', field.suffix, index - 1)"
              @keydown.stop
            >←</button>
            <button
              type="button"
              class="neye-field-move-button"
              :disabled="index === orderedValueFields.length - 1"
              :aria-label="`${field.label}右移`"
              @click.stop="moveSortableItem('value', field.suffix, index + 1)"
              @keydown.stop
            >→</button>
          </div>
        </div>
      </section>
      <section class="neye-field-sorter-section" aria-labelledby="extra-field-order-title">
        <h3 id="extra-field-order-title" class="neye-field-sorter-title">
          附加字段顺序
        </h3>
        <div class="neye-field-sorter-list" role="list">
          <div
            v-for="(field, index) in orderedExtraFields"
            :key="field.key"
            class="neye-field-sorter-item"
            :class="{
              'is-dragging': draggedGroup === 'extra' && draggedKey === field.key,
              'is-drop-target': draggedGroup === 'extra' && dragOverKey === field.key && draggedKey !== field.key,
              'is-hidden': isExtraHidden(field.key),
            }"
            role="listitem"
            tabindex="0"
            :aria-label="sortableItemLabel('extra', field.key, index, orderedExtraFields.length)"
            @dragover="handleDragOver($event, 'extra', field.key)"
            @drop.prevent="handleDrop('extra', field.key)"
            @keydown="handleSortableKeydown($event, 'extra', field.key, index)"
          >
            <span
              class="neye-field-drag-handle"
              draggable="true"
              :aria-label="`拖动${field.label}`"
              @dragend="finishDrag"
              @dragstart="handleDragStart($event, 'extra', field.key)"
            >⋮⋮</span>
            <span class="neye-field-sorter-name">{{ field.compactLabel }}</span>
            <button
              type="button"
              class="neye-field-visibility"
              :aria-label="`${field.label}${isExtraHidden(field.key) ? '已隐藏，点击显示' : '显示中，点击隐藏'}`"
              @click.stop="toggleSortableItem('extra', field.key)"
              @keydown.stop
            >
              {{ isExtraHidden(field.key) ? '已隐藏' : '显示中' }}
            </button>
            <button
              type="button"
              class="neye-field-move-button"
              :disabled="index === 0"
              :aria-label="`${field.label}左移`"
              @click.stop="moveSortableItem('extra', field.key, index - 1)"
              @keydown.stop
            >←</button>
            <button
              type="button"
              class="neye-field-move-button"
              :disabled="index === orderedExtraFields.length - 1"
              :aria-label="`${field.label}右移`"
              @click.stop="moveSortableItem('extra', field.key, index + 1)"
              @keydown.stop
            >→</button>
          </div>
        </div>
      </section>
    </div>

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
.neye-field-sorters {
  display: grid;
  gap: 14px;
  margin-bottom: 16px;
}
.neye-field-sorters-hint {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}
.neye-field-sorter-section {
  display: grid;
  gap: 8px;
}
.neye-field-sorter-title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 650;
}
.neye-field-sorter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.neye-field-sorter-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 3px 5px 3px 7px;
  border: 1px solid hsl(var(--border));
  border-radius: 7px;
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    opacity 180ms ease,
    box-shadow 180ms ease;
}
.neye-field-sorter-item:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}
.neye-field-sorter-item.is-hidden {
  background: hsl(var(--muted) / 0.45);
  color: hsl(var(--muted-foreground));
}
.neye-field-sorter-item.is-dragging {
  opacity: 0.45;
}
.neye-field-sorter-item.is-drop-target {
  border-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.08);
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.14);
}
.neye-field-drag-handle {
  color: hsl(var(--muted-foreground));
  cursor: grab;
  font-size: 14px;
  letter-spacing: -3px;
  line-height: 1;
  user-select: none;
}
.neye-field-drag-handle:active {
  cursor: grabbing;
}
.neye-field-sorter-name {
  min-width: 28px;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}
.neye-field-visibility,
.neye-field-move-button {
  height: 26px;
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 12px;
}
.neye-field-visibility {
  padding: 0 7px;
}
.neye-field-move-button {
  width: 26px;
  padding: 0;
}
.neye-field-visibility:hover,
.neye-field-move-button:hover:not(:disabled) {
  border-color: hsl(var(--primary));
  color: hsl(var(--primary));
}
.neye-field-move-button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}
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