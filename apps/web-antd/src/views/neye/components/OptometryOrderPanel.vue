<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons-vue';
import { Modal, message } from 'ant-design-vue';
import { useRouter } from 'vue-router';

import { apiRequest, cleanPayload } from '#/api/neye';
import type {
  FittingOrder,
  OptometryOrder,
  PageResult,
  ProductItem,
  ProductItemCategory,
} from '#/types/neye';
import { formatDate, money } from '#/utils/neye-format';

import OptometryPrescriptionTable from './OptometryPrescriptionTable.vue';
import {
  defaultOptometryStyle,
  normalizeOptometryStyle,
  optometryExtraFields,
  optometryFieldName,
  optometryRows,
  optometryValueFields,
  type OptometryStyleConfig,
} from '../optometry-prescription';

interface SelectOption {
  label: string;
  value: string;
}
interface FittingSection {
  infoKey: string;
  key: ProductItemCategory;
  label: string;
  priceKey: string;
  productKey: string;
}

const props = defineProps<{ orderId: string }>();
const emit = defineEmits<{
  deleted: [];
  'open-fitting': [order: FittingOrder];
  updated: [];
}>();

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const creatingFitting = ref(false);
const createOpen = ref(false);
const order = ref<OptometryOrder | null>(null);
const baseline = ref('');
const loadVersion = ref(0);
const optometryStyle = ref<OptometryStyleConfig>(defaultOptometryStyle);
const optometryForm = reactive<Record<string, unknown>>({});
const fittingSections: FittingSection[] = [
  {
    infoKey: 'frameInfo',
    key: 'frame',
    label: '镜架',
    priceKey: 'framePrice',
    productKey: 'frameProductItemId',
  },
  {
    infoKey: 'lensInfo',
    key: 'lens',
    label: '镜片',
    priceKey: 'lensPrice',
    productKey: 'lensProductItemId',
  },
  {
    infoKey: 'otherInfo',
    key: 'other',
    label: '其他',
    priceKey: 'otherPrice',
    productKey: 'otherProductItemId',
  },
];
const productCaches = reactive<Record<ProductItemCategory, ProductItem[]>>({
  frame: [],
  lens: [],
  other: [],
});
const productOptions = reactive<Record<ProductItemCategory, SelectOption[]>>({
  frame: [],
  lens: [],
  other: [],
});
const fittingForm = reactive<Record<string, string | undefined>>({
  frameInfo: '',
  framePrice: '',
  frameProductItemId: undefined,
  lensInfo: '',
  lensPrice: '',
  lensProductItemId: undefined,
  otherInfo: '',
  otherPrice: '',
  otherProductItemId: undefined,
  remark: '',
});
const fittingColumns = [
  { dataIndex: 'orderNo', key: 'orderNo', title: '配镜单号' },
  { dataIndex: 'frameInfo', key: 'frameInfo', title: '镜架' },
  { dataIndex: 'lensInfo', key: 'lensInfo', title: '镜片' },
  { dataIndex: 'totalAmount', key: 'totalAmount', title: '金额', width: 120 },
  { dataIndex: 'createdAt', key: 'createdAt', title: '创建时间', width: 130 },
  { key: 'action', title: '操作', width: 80 },
];
const isDirty = computed(
  () => baseline.value !== '' && baseline.value !== JSON.stringify(optometryForm),
);
const previewTotal = computed(() =>
  money(
    Number(fittingForm.framePrice || 0) +
      Number(fittingForm.lensPrice || 0) +
      Number(fittingForm.otherPrice || 0),
  ),
);

function updateOptometryForm(value: Record<string, unknown>) {
  Object.assign(optometryForm, value);
}

function fillOptometryForm(source: OptometryOrder) {
  Object.keys(optometryForm).forEach((key) => delete optometryForm[key]);
  optometryForm.optometryDate = formatDate(source.optometryDate);
  optometryForm.remark = source.remark ?? '';
  for (const row of optometryRows) {
    for (const field of optometryValueFields) {
      const key = optometryFieldName(row.group, field.suffix);
      optometryForm[key] = source[key] ?? '';
    }
  }
  for (const field of optometryExtraFields) {
    optometryForm[field.key] = source[field.key] ?? '';
  }
  baseline.value = JSON.stringify(optometryForm);
}

async function load() {
  const version = ++loadVersion.value;
  loading.value = true;
  try {
    const loadedOrder = await apiRequest<OptometryOrder>(
      `/optometry-orders/${props.orderId}`,
    );
    const styleParams = new URLSearchParams({ tenantId: loadedOrder.tenantId });
    const loadedStyle = await apiRequest<Partial<OptometryStyleConfig>>(
      `/system-settings/optometry-style?${styleParams}`,
    );
    if (version !== loadVersion.value) return;
    order.value = loadedOrder;
    optometryStyle.value = normalizeOptometryStyle(loadedStyle);
    fillOptometryForm(loadedOrder);
  } catch (error) {
    if (version === loadVersion.value) {
      message.error(error instanceof Error ? error.message : '加载失败');
    }
  } finally {
    if (version === loadVersion.value) loading.value = false;
  }
}

async function saveOptometry() {
  saving.value = true;
  try {
    await apiRequest<OptometryOrder>(`/optometry-orders/${props.orderId}`, {
      body: JSON.stringify(optometryForm),
      method: 'PATCH',
    });
    message.success('验光单已保存');
    await load();
    emit('updated');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

function confirmDiscardChanges() {
  if (!isDirty.value) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      cancelText: '继续编辑',
      content: '当前验光单有尚未保存的修改，切换后这些修改会丢失。',
      okText: '放弃修改',
      okType: 'danger',
      title: '放弃未保存内容？',
      onCancel: () => resolve(false),
      onOk: () => resolve(true),
    });
  });
}

async function searchProducts(
  category: ProductItemCategory,
  keyword = '',
) {
  const params = new URLSearchParams({
    category,
    page: '1',
    pageSize: '20',
  });
  if (keyword) params.set('keyword', keyword);
  const page = await apiRequest<PageResult<ProductItem>>(
    `/product-items?${params}`,
  );
  productCaches[category] = page.items;
  productOptions[category] = page.items.map((item) => ({
    label: `${item.name} / ${money(item.defaultPrice)} / ${item.usageCount}次`,
    value: item.name,
  }));
}

async function handleProductSearch(
  section: FittingSection,
  keyword: string,
) {
  await searchProducts(section.key, keyword.trim());
}

function handleProductInfoChange(
  section: FittingSection,
  value: unknown,
) {
  const currentValue =
    typeof value === 'string'
      ? value
      : String(fittingForm[section.infoKey] ?? '');
  const selectedProductId = fittingForm[section.productKey];
  const selectedProduct = selectedProductId
    ? productCaches[section.key].find(
        (item) => item.id === selectedProductId,
      )
    : undefined;
  if (selectedProduct?.name !== currentValue) {
    fittingForm[section.productKey] = undefined;
  }
}

function selectProduct(section: FittingSection, value: string) {
  const item = productCaches[section.key].find(
    (current) => current.name === value || current.id === value,
  );
  if (!item) return;
  fittingForm[section.productKey] = item.id;
  fittingForm[section.infoKey] = item.name;
  fittingForm[section.priceKey] = String(item.defaultPrice ?? '0');
}

async function openCreate() {
  createOpen.value = true;
  await Promise.all([
    searchProducts('frame'),
    searchProducts('lens'),
    searchProducts('other'),
  ]);
}

async function submitFitting() {
  creatingFitting.value = true;
  try {
    const created = await apiRequest<FittingOrder>(
      `/optometry-orders/${props.orderId}/fitting-orders`,
      {
        body: JSON.stringify(cleanPayload(fittingForm)),
        method: 'POST',
      },
    );
    message.success('配镜单已创建');
    createOpen.value = false;
    Object.assign(fittingForm, {
      frameInfo: '',
      framePrice: '',
      frameProductItemId: undefined,
      lensInfo: '',
      lensPrice: '',
      lensProductItemId: undefined,
      otherInfo: '',
      otherPrice: '',
      otherProductItemId: undefined,
      remark: '',
    });
    await load();
    emit('updated');
    emit('open-fitting', created);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  } finally {
    creatingFitting.value = false;
  }
}

function removeOrder() {
  if (!order.value) return;
  Modal.confirm({
    cancelText: '取消',
    content: '已有配镜单的验光单不能删除。确认删除当前验光单？',
    okText: '删除',
    okType: 'danger',
    title: '删除验光单',
    async onOk() {
      await apiRequest(`/optometry-orders/${props.orderId}`, {
        method: 'DELETE',
      });
      message.success('验光单已删除');
      emit('deleted');
    },
  });
}

watch(
  () => props.orderId,
  () => void load(),
  { immediate: true },
);

defineExpose({ confirmDiscardChanges, reload: load });
</script>

<template>
  <a-spin :spinning="loading">
    <template v-if="order">
      <section class="neye-panel neye-optometry-panel">
        <div class="neye-order-panel-head">
          <div>
            <h2 class="neye-section-title">{{ formatDate(order.optometryDate) }}</h2>
            <p class="neye-page-subtitle">{{ order.orderNo }}</p>
          </div>
          <a-space wrap>
            <a-button
              type="primary"
              :icon="h(SaveOutlined)"
              :loading="saving"
              @click="saveOptometry"
            >
              保存验光单
            </a-button>
            <a-button :icon="h(PlusOutlined)" @click="openCreate">新增配镜单</a-button>
            <a-button danger :icon="h(DeleteOutlined)" @click="removeOrder">删除</a-button>
          </a-space>
        </div>

        <div class="neye-section-head neye-prescription-heading">
          <h3 class="neye-section-title">验光数据</h3>
          <div class="neye-prescription-actions">
            <span v-if="isDirty" class="neye-unsaved-mark">未保存</span>
            <a-button
              type="link"
              class="neye-link-button"
              @click="router.push('/neye/store-settings/optometry-style')"
            >
              调整样式
            </a-button>
          </div>
        </div>
        <a-form layout="vertical" :model="optometryForm" @finish="saveOptometry">
          <OptometryPrescriptionTable
            :model-value="optometryForm"
            editable
            @update:model-value="updateOptometryForm"
            mode="form"
            :style-config="optometryStyle"
          />
        </a-form>
      </section>

      <section class="neye-panel">
        <div class="neye-section-head">
          <div>
            <h3 class="neye-section-title">关联配镜单</h3>
            <p class="neye-page-subtitle">共 {{ order.fittingOrders?.length || 0 }} 张</p>
          </div>
          <a-button :icon="h(PlusOutlined)" @click="openCreate">新增</a-button>
        </div>
        <a-table
          row-key="id"
          size="middle"
          :columns="fittingColumns"
          :data-source="order.fittingOrders || []"
          :pagination="false"
          :scroll="{ x: 760 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'totalAmount'">
              <span class="neye-money">{{ money(record.totalAmount) }}</span>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDate(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                type="link"
                class="neye-link-button"
                @click="emit('open-fitting', record as FittingOrder)"
              >
                查看
              </a-button>
            </template>
          </template>
          <template #emptyText>暂无配镜单</template>
        </a-table>
      </section>
    </template>
  </a-spin>

  <a-modal
    v-model:open="createOpen"
    title="新增配镜单"
    width="780px"
    :footer="null"
    destroy-on-close
  >
    <a-form layout="vertical" :model="fittingForm" @finish="submitFitting">
      <div
        v-for="section in fittingSections"
        :key="section.key"
        class="neye-form-grid"
      >
        <a-form-item :label="`${section.label}品名`">
          <a-auto-complete
            v-model:value="fittingForm[section.infoKey]"
            allow-clear
            :filter-option="false"
            :options="productOptions[section.key]"
            @change="(value: unknown) => handleProductInfoChange(section, value)"
            @search="(value: string) => handleProductSearch(section, value)"
            @select="(value: unknown) => selectProduct(section, String(value))"
          />
        </a-form-item>
        <a-form-item :label="`${section.label}价格`">
          <a-input v-model:value="fittingForm[section.priceKey]" />
        </a-form-item>
      </div>
      <a-form-item label="备注">
        <a-textarea v-model:value="fittingForm.remark" :rows="3" />
      </a-form-item>
      <div class="neye-total-line">
        配镜金额：<span class="neye-money">{{ previewTotal }}</span>
      </div>
      <a-space>
        <a-button type="primary" html-type="submit" :loading="creatingFitting">保存</a-button>
        <a-button @click="createOpen = false">取消</a-button>
      </a-space>
    </a-form>
  </a-modal>
</template>

<style src="../neye.css"></style>
<style scoped>
.neye-optometry-panel {
  overflow: hidden;
}
.neye-order-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.neye-order-panel-head .neye-section-title {
  margin-bottom: 0;
  font-size: 20px;
}
.neye-prescription-heading {
  padding-top: 16px;
  border-top: 1px solid hsl(var(--border));
}
.neye-prescription-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.neye-unsaved-mark {
  color: #b45309;
  font-size: 13px;
}
@media (max-width: 900px) {
  .neye-order-panel-head {
    display: block;
  }
  .neye-order-panel-head .ant-space {
    margin-top: 12px;
  }
}
</style>