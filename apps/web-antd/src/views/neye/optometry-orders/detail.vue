<script setup lang="ts">
defineOptions({ name: 'NEyeOptometryDetail' });
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons-vue';
import { apiRequest, cleanPayload } from '#/api/neye';
import type { FittingOrder, OptometryOrder, PageResult, ProductItem, ProductItemCategory } from '#/types/neye';
import { formatDate, money } from '#/utils/neye-format';
import OptometryPrescriptionTable from '../components/OptometryPrescriptionTable.vue';
import { defaultOptometryStyle, normalizeOptometryStyle, optometryExtraFields, optometryFieldName, optometryRows, optometryValueFields, type OptometryStyleConfig } from '../optometry-prescription';

interface SelectOption { label: string; value: string }
interface FittingSection { key: ProductItemCategory; label: string; infoKey: string; priceKey: string; productKey: string }

const route = useRoute();
const router = useRouter();
const orderId = computed(() => String(route.params.id));
const loading = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const order = ref<OptometryOrder | null>(null);
const optometryStyle = ref<OptometryStyleConfig>(defaultOptometryStyle);
const optometryForm = reactive<Record<string, unknown>>({});
const fittingSections: FittingSection[] = [
  { key: 'frame', label: '镜架', infoKey: 'frameInfo', priceKey: 'framePrice', productKey: 'frameProductItemId' },
  { key: 'lens', label: '镜片', infoKey: 'lensInfo', priceKey: 'lensPrice', productKey: 'lensProductItemId' },
  { key: 'other', label: '其他', infoKey: 'otherInfo', priceKey: 'otherPrice', productKey: 'otherProductItemId' },
];
const productCaches = reactive<Record<ProductItemCategory, ProductItem[]>>({ frame: [], lens: [], other: [] });
const productOptions = reactive<Record<ProductItemCategory, SelectOption[]>>({ frame: [], lens: [], other: [] });
const fittingForm = reactive<Record<string, string | undefined>>({ frameProductItemId: undefined, frameInfo: '', framePrice: '', lensProductItemId: undefined, lensInfo: '', lensPrice: '', otherProductItemId: undefined, otherInfo: '', otherPrice: '', remark: '' });
const fittingColumns = [
  { title: '配镜单号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '镜架', dataIndex: 'frameInfo', key: 'frameInfo' },
  { title: '镜片', dataIndex: 'lensInfo', key: 'lensInfo' },
  { title: '其他', dataIndex: 'otherInfo', key: 'otherInfo' },
  { title: '金额', dataIndex: 'totalAmount', key: 'totalAmount', width: 120 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 130 },
  { title: '操作', key: 'action', width: 100 },
];
const previewTotal = computed(() => money(Number(fittingForm.framePrice || 0) + Number(fittingForm.lensPrice || 0) + Number(fittingForm.otherPrice || 0)));

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
}

async function loadStyle() {
  optometryStyle.value = normalizeOptometryStyle(await apiRequest<Partial<OptometryStyleConfig>>('/system-settings/optometry-style'));
}

async function load() {
  loading.value = true;
  try {
    const [loadedOrder] = await Promise.all([
      apiRequest<OptometryOrder>(`/optometry-orders/${orderId.value}`),
      loadStyle(),
    ]);
    order.value = loadedOrder;
    fillOptometryForm(loadedOrder);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveOptometry() {
  saving.value = true;
  try {
    await apiRequest<OptometryOrder>(`/optometry-orders/${orderId.value}`, { method: 'PATCH', body: JSON.stringify(optometryForm) });
    message.success('验光单已保存');
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

async function searchProducts(category: ProductItemCategory, keyword = '') {
  const params = new URLSearchParams({ category, page: '1', pageSize: '20' });
  if (keyword) params.set('keyword', keyword);
  const page = await apiRequest<PageResult<ProductItem>>(`/product-items?${params}`);
  productCaches[category] = page.items;
  productOptions[category] = page.items.map((item) => ({ value: item.name, label: `${item.name} / ${money(item.defaultPrice)} / ${item.usageCount}次` }));
}

async function handleProductSearch(section: FittingSection, keyword: string) {
  await searchProducts(section.key, keyword.trim());
}

function handleProductInfoChange(section: FittingSection, value: unknown) {
  const currentValue = typeof value === 'string' ? value : String(fittingForm[section.infoKey] ?? '');
  const selectedProductId = fittingForm[section.productKey];
  const selectedProduct = selectedProductId ? productCaches[section.key].find((item) => item.id === selectedProductId) : undefined;
  if (selectedProduct?.name !== currentValue) fittingForm[section.productKey] = undefined;
}

function selectProduct(section: FittingSection, value: string) {
  const item = productCaches[section.key].find((current) => current.name === value || current.id === value);
  if (!item) return;
  fittingForm[section.productKey] = item.id;
  fittingForm[section.infoKey] = item.name;
  fittingForm[section.priceKey] = String(item.defaultPrice ?? '0');
}

async function openCreate() {
  if (!order.value) return;
  createOpen.value = true;
  await Promise.all([searchProducts('frame'), searchProducts('lens'), searchProducts('other')]);
}

async function submitFitting() {
  try {
    const created = await apiRequest<FittingOrder>(`/optometry-orders/${orderId.value}/fitting-orders`, { method: 'POST', body: JSON.stringify(cleanPayload(fittingForm)) });
    message.success('配镜单已创建');
    createOpen.value = false;
    Object.assign(fittingForm, { frameProductItemId: undefined, frameInfo: '', framePrice: '', lensProductItemId: undefined, lensInfo: '', lensPrice: '', otherProductItemId: undefined, otherInfo: '', otherPrice: '', remark: '' });
    await load();
    router.push(`/neye/fitting-orders/${created.id}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '创建失败');
  }
}

function removeOrder() {
  if (!order.value) return;
  Modal.confirm({
    title: '删除验光单',
    content: '已有配镜单的验光单不能删除。确认删除当前验光单？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await apiRequest(`/optometry-orders/${orderId.value}`, { method: 'DELETE' });
      message.success('验光单已删除');
      router.push(`/neye/customers/${order.value?.customerId}`);
    },
  });
}

onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <a-spin :spinning="loading">
      <div class="neye-page-head">
        <div>
          <h1 class="neye-page-title">{{ order?.orderNo || '验光单详情' }}</h1>
          <p class="neye-page-subtitle">{{ order?.customer?.name || '-' }} / {{ formatDate(order?.optometryDate) }}</p>
        </div>
        <a-space>
          <a-button @click="router.push(`/neye/customers/${order?.customerId}`)">返回客户</a-button>
          <a-button type="primary" :icon="h(SaveOutlined)" :loading="saving" @click="saveOptometry">保存验光单</a-button>
          <a-button danger :icon="h(DeleteOutlined)" @click="removeOrder">删除</a-button>
          <a-button :icon="h(PlusOutlined)" @click="openCreate">新增配镜单</a-button>
        </a-space>
      </div>

      <section class="neye-panel" style="margin-bottom: 14px">
        <div class="neye-section-head">
          <h2 class="neye-section-title">验光数据</h2>
          <a-button type="link" class="neye-link-button" @click="router.push('/neye/system/optometry-style')">调整样式</a-button>
        </div>
        <a-form layout="vertical" :model="optometryForm" @finish="saveOptometry">
          <a-form-item label="验光日期" name="optometryDate" :rules="[{ required: true, message: '请选择验光日期' }]" style="max-width: 220px">
            <a-input v-model:value="optometryForm.optometryDate" type="date" />
          </a-form-item>
          <OptometryPrescriptionTable v-model="optometryForm" editable mode="form" :style-config="optometryStyle" />
        </a-form>
      </section>

      <section class="neye-panel">
        <h2 class="neye-section-title">关联配镜单</h2>
        <a-table row-key="id" :columns="fittingColumns" :data-source="order?.fittingOrders || []" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'totalAmount'"><span class="neye-money">{{ money(record.totalAmount) }}</span></template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDate(record.createdAt) }}</template>
            <template v-else-if="column.key === 'action'"><a-button type="link" class="neye-link-button" @click="router.push(`/neye/fitting-orders/${record.id}`)">详情</a-button></template>
          </template>
        </a-table>
      </section>
    </a-spin>

    <a-modal v-model:open="createOpen" title="新增配镜单" width="780px" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="fittingForm" @finish="submitFitting">
        <div v-for="section in fittingSections" :key="section.key" class="neye-form-grid">
          <a-form-item :label="`${section.label}信息`">
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
          <a-form-item :label="`${section.label}价格`"><a-input v-model:value="fittingForm[section.priceKey]" /></a-form-item>
        </div>
        <a-form-item label="备注"><a-textarea v-model:value="fittingForm.remark" :rows="3" /></a-form-item>
        <div class="neye-total-line">配镜金额：<span class="neye-money">{{ previewTotal }}</span></div>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="createOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>