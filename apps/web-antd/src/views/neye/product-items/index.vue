<script setup lang="ts">
defineOptions({ name: 'NEyeProductItems' });
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { Modal, message } from 'ant-design-vue';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { apiRequest, cleanPayload } from '#/api/neye';
import type { BatchDeleteResult, PageResult, ProductItem, ProductItemCategory } from '#/types/neye';
import { formatDate, money, productCategoryText } from '#/utils/neye-format';

const categories: Array<{ key: ProductItemCategory; label: string }> = [
  { key: 'frame', label: '镜架' },
  { key: 'lens', label: '镜片' },
  { key: 'other', label: '其他' },
];
const activeCategory = ref<ProductItemCategory>('frame');
const loading = ref(false);
const createOpen = ref(false);
const editOpen = ref(false);
const editingItem = ref<ProductItem | null>(null);
const selectedRowKeys = ref<string[]>([]);
const selectedCount = computed(() => selectedRowKeys.value.length);
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: Array<number | string>) => {
    selectedRowKeys.value = keys.map(String);
  },
}));
const query = reactive({ keyword: '', page: 1, pageSize: 10 });
const result = ref<PageResult<ProductItem>>({ items: [], total: 0, page: 1, pageSize: 10 });
const form = reactive({ name: '', defaultPrice: '', remark: '' });
const editForm = reactive({ name: '', defaultPrice: '', remark: '' });
const columns = [
  { title: '名称/信息', dataIndex: 'name', key: 'name' },
  { title: '默认价格', dataIndex: 'defaultPrice', key: 'defaultPrice', width: 130 },
  { title: '使用次数', dataIndex: 'usageCount', key: 'usageCount', width: 110 },
  { title: '最后使用', dataIndex: 'lastUsedAt', key: 'lastUsedAt', width: 130 },
  { title: '备注', dataIndex: 'remark', key: 'remark' },
  { title: '操作', key: 'action', width: 130 },
];

async function load(page = query.page) {
  loading.value = true;
  query.page = page;
  selectedRowKeys.value = [];
  try {
    const params = new URLSearchParams({ category: activeCategory.value, page: String(query.page), pageSize: String(query.pageSize) });
    if (query.keyword) params.set('keyword', query.keyword);
    result.value = await apiRequest<PageResult<ProductItem>>(`/product-items?${params}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

async function submitCreate() {
  try {
    await apiRequest<ProductItem>('/product-items', { method: 'POST', body: JSON.stringify(cleanPayload({ category: activeCategory.value, ...form })) });
    message.success('字典项已保存');
    createOpen.value = false;
    Object.assign(form, { name: '', defaultPrice: '', remark: '' });
    await load(1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  }
}

function openEdit(item: ProductItem) {
  editingItem.value = item;
  Object.assign(editForm, { name: item.name, defaultPrice: String(item.defaultPrice ?? ''), remark: item.remark ?? '' });
  editOpen.value = true;
}

async function submitEdit() {
  if (!editingItem.value) return;
  try {
    await apiRequest<ProductItem>(`/product-items/${editingItem.value.id}`, { method: 'PATCH', body: JSON.stringify(cleanPayload(editForm)) });
    message.success('字典项已更新');
    editOpen.value = false;
    editingItem.value = null;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  }
}

function removeItem(item: ProductItem) {
  Modal.confirm({
    title: '删除字典项',
    content: `确认删除「${item.name}」？历史配镜单不受影响。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await apiRequest(`/product-items/${item.id}`, { method: 'DELETE' });
      message.success('字典项已删除');
      await load();
    },
  });
}

function batchRemoveItems() {
  if (selectedRowKeys.value.length === 0) {
    message.warning('请先选择字典项');
    return;
  }
  Modal.confirm({
    title: '批量删除字典项',
    content: `确认删除选中的 ${selectedRowKeys.value.length} 个字典项？历史配镜单不受影响。`,
    okText: '批量删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      const deleted = await apiRequest<BatchDeleteResult>('/product-items/batch-delete', { method: 'POST', body: JSON.stringify({ ids: selectedRowKeys.value }) });
      message.success(`已删除 ${deleted.deletedCount} 个字典项`);
      await load(1);
    },
  });
}

function handleTableChange(pagination: { current?: number }) {
  load(Number(pagination.current || 1));
}


watch(activeCategory, () => load(1));
onMounted(() => load());
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">商品字典</h1>
        <p class="neye-page-subtitle">镜架、镜片和其他常用输入项</p>
      </div>
      <a-button type="primary" :icon="h(PlusOutlined)" @click="createOpen = true">新增字典项</a-button>
    </div>

    <section class="neye-panel">
      <a-tabs v-model:active-key="activeCategory"><a-tab-pane v-for="item in categories" :key="item.key" :tab="item.label" /></a-tabs>
      <div class="neye-toolbar">
        <a-input v-model:value="query.keyword" allow-clear :placeholder="`搜索${productCategoryText(activeCategory)}信息`" style="width: 280px" @press-enter="load(1)" />
        <a-button :icon="h(SearchOutlined)" @click="load(1)">查询</a-button>
        <a-button danger :disabled="selectedCount === 0" :icon="h(DeleteOutlined)" @click="batchRemoveItems">批量删除{{ selectedCount ? ` ${selectedCount}` : '' }}</a-button>
      </div>
      <a-table row-key="id" :columns="columns" :data-source="result.items" :loading="loading" :pagination="{ current: query.page, pageSize: query.pageSize, total: result.total, showSizeChanger: false }" :row-selection="rowSelection" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'defaultPrice'"><span class="neye-money">{{ money(record.defaultPrice) }}</span></template>
          <template v-else-if="column.key === 'lastUsedAt'">{{ formatDate(record.lastUsedAt) }}</template>
          <template v-else-if="column.key === 'remark'">{{ record.remark || '-' }}</template>
          <template v-else-if="column.key === 'action'"><a-space><a-button type="text" :icon="h(EditOutlined)" @click="openEdit(record)" /><a-button danger type="text" :icon="h(DeleteOutlined)" @click="removeItem(record)" /></a-space></template>
        </template>
      </a-table>
    </section>

    <a-modal v-model:open="createOpen" title="新增字典项" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="form" @finish="submitCreate">
        <a-form-item label="名称/信息" name="name" :rules="[{ required: true, message: '请填写名称/信息' }]"><a-input v-model:value="form.name" /></a-form-item>
        <a-form-item label="默认价格" name="defaultPrice"><a-input v-model:value="form.defaultPrice" /></a-form-item>
        <a-form-item label="备注" name="remark"><a-textarea v-model:value="form.remark" :rows="3" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="createOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>

    <a-modal v-model:open="editOpen" title="编辑字典项" :footer="null" destroy-on-close>
      <a-form layout="vertical" :model="editForm" @finish="submitEdit">
        <a-form-item label="名称/信息" name="name" :rules="[{ required: true, message: '请填写名称/信息' }]"><a-input v-model:value="editForm.name" /></a-form-item>
        <a-form-item label="默认价格" name="defaultPrice"><a-input v-model:value="editForm.defaultPrice" /></a-form-item>
        <a-form-item label="备注" name="remark"><a-textarea v-model:value="editForm.remark" :rows="3" /></a-form-item>
        <a-space><a-button type="primary" html-type="submit">保存</a-button><a-button @click="editOpen = false">取消</a-button></a-space>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>