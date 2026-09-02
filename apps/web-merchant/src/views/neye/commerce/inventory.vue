<script setup lang="ts">
import type {
  CommercePermission,
  InventoryBalance,
  ProductItem,
  TenantSku,
} from '#/api/neye';

import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import {
  apiRequest,
  commerceApi,
  neyeStatusLabel,
  neyeTypeLabel,
} from '#/api/neye';
import { useNeyePermissions } from '#/composables/useNeyePermissions';

defineOptions({ name: 'NEyeInventory' });

const { can } = useNeyePermissions();

const loading = ref(false);
const balances = ref<InventoryBalance[]>([]);
const skus = ref<TenantSku[]>([]);
const documents = ref<Array<Record<string, any>>>([]);
const movements = ref<Array<Record<string, any>>>([]);
const products = ref<ProductItem[]>([]);
const actionOpen = ref(false);
const skuOpen = ref(false);
const action = reactive({
  confirmNegative: false,
  countedQuantity: 0,
  direction: 'in',
  quantity: 1,
  remark: '',
  targetTenantId: '',
  tenantSkuId: '',
  type: 'inbound',
  unitCost: '0.00',
});
const skuForm = reactive({
  barcode: '',
  lowStockThreshold: 0,
  productItemId: '',
  salePrice: '0.00',
  skuCode: '',
  trackInventory: true,
  unit: '件',
});

async function load() {
  loading.value = true;
  try {
    const [inventory, skuResult, docs, logs] = await Promise.all([
      commerceApi.listInventory(),
      commerceApi.listSkus(),
      commerceApi.listInventoryDocuments(),
      commerceApi.listInventoryMovements(),
    ]);
    balances.value = inventory.items;
    skus.value = skuResult.items;
    documents.value = docs.items;
    movements.value = logs.items;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '库存加载失败');
  } finally {
    loading.value = false;
  }
}

async function openSku() {
  if (!can('inventory.receive'))
    return message.warning('当前账号没有维护门店 SKU 的权限，请联系管理员');
  skuOpen.value = true;
  if (products.value.length === 0) {
    const result = await apiRequest<{ items: ProductItem[] }>(
      '/product-items?pageSize=100',
    );
    products.value = result.items;
  }
}

async function createSku() {
  if (!can('inventory.receive'))
    return message.warning('当前账号没有维护门店 SKU 的权限，请联系管理员');
  try {
    await commerceApi.createSku(skuForm);
    message.success('门店 SKU 已创建');
    skuOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'SKU 创建失败');
  }
}

function openAction(type: string) {
  const requiredPermission: Record<string, CommercePermission> = {
    adjustment: 'inventory.adjust',
    inbound: 'inventory.receive',
    stocktake: 'inventory.count',
  };
  const required = requiredPermission[type] ?? 'inventory.transfer';
  if (!can(required))
    return message.warning('当前账号没有执行该库存操作的权限，请联系管理员');
  Object.assign(action, {
    confirmNegative: false,
    countedQuantity: 0,
    direction: 'in',
    quantity: 1,
    remark: '',
    targetTenantId: '',
    tenantSkuId: balances.value[0]?.tenantSkuId ?? '',
    type,
    unitCost: '0.00',
  });
  actionOpen.value = true;
}

async function submitAction() {
  try {
    await commerceApi.createInventoryDocument({
      confirmNegative: action.confirmNegative,
      lines: [
        {
          countedQuantity:
            action.type === 'stocktake' ? action.countedQuantity : undefined,
          direction:
            action.type === 'adjustment' ? action.direction : undefined,
          quantity: action.quantity,
          tenantSkuId: action.tenantSkuId,
          unitCost: action.unitCost,
        },
      ],
      remark: action.remark,
      targetTenantId:
        action.type === 'transfer' ? action.targetTenantId : undefined,
      type: action.type,
    });
    message.success('库存单据已过账');
    actionOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '库存操作失败');
  }
}

async function receive(id: string) {
  if (!can('inventory.transfer'))
    return message.warning('当前账号没有接收调拨的权限，请联系管理员');
  try {
    await commerceApi.receiveTransfer(id);
    message.success('调拨已接收');
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '接收失败');
  }
}

onMounted(load);
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">库存管理</h1>
        <p class="neye-page-subtitle">
          管理门店 SKU、现存/预占/可用库存以及不可修改的库存流水。
        </p>
      </div>
      <a-space wrap>
        <a-button v-if="can('inventory.receive')" @click="openSku">
          新增 SKU
        </a-button>
        <a-button
          v-if="can('inventory.receive')"
          @click="openAction('inbound')"
        >
          直接入库
        </a-button>
        <a-button
          v-if="can('inventory.adjust')"
          @click="openAction('adjustment')"
        >
          库存调整
        </a-button>
        <a-button
          v-if="can('inventory.count')"
          @click="openAction('stocktake')"
        >
          盘点
        </a-button>
        <a-button
          v-if="can('inventory.transfer')"
          type="primary"
          @click="openAction('transfer')"
        >
          门店调拨
        </a-button>
      </a-space>
    </div>
    <a-spin :spinning="loading">
      <a-tabs>
        <a-tab-pane key="balances" tab="库存余额">
          <a-table
            :data-source="balances"
            row-key="tenantSkuId"
            :pagination="{ pageSize: 20 }"
          >
            <a-table-column data-index="name" title="商品" />
            <a-table-column data-index="skuCode" title="SKU" />
            <a-table-column data-index="barcode" title="条码" />
            <a-table-column data-index="onHand" title="现存" />
            <a-table-column data-index="reserved" title="预占" />
            <a-table-column data-index="available" title="可用" />
            <a-table-column data-index="averageCost" title="移动加权成本" />
            <a-table-column title="状态">
              <template #default="{ record }">
                <a-tag :color="record.lowStock ? 'red' : 'green'">
                  {{ record.lowStock ? '库存预警' : '正常' }}
                </a-tag>
              </template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="documents" tab="库存单据">
          <a-table :data-source="documents" row-key="id">
            <a-table-column
              data-index="documentNo"
              title="单号"
            /><a-table-column data-index="type" title="类型">
              <template #default="{ text }">
                {{ neyeTypeLabel(text) }}
              </template> </a-table-column
            ><a-table-column data-index="status" title="状态">
              <template #default="{ text }">
                {{ neyeStatusLabel(text) }}
              </template> </a-table-column
            ><a-table-column
              data-index="createdAt"
              title="创建时间"
            /><a-table-column title="操作">
              <template #default="{ record }">
                <a-button
                  v-if="
                    record.status === 'in_transit' && can('inventory.transfer')
                  "
                  type="link"
                  @click="receive(record.id)"
                >
                  接收
                </a-button>
              </template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="movements" tab="库存流水">
          <a-table :data-source="movements" row-key="id">
            <a-table-column data-index="skuCode" title="SKU" /><a-table-column
              data-index="type"
              title="类型"
            >
              <template #default="{ text }">
                {{ neyeTypeLabel(text) }}
              </template> </a-table-column
            ><a-table-column
              data-index="onHandDelta"
              title="现存变化"
            /><a-table-column
              data-index="reservedDelta"
              title="预占变化"
            /><a-table-column
              data-index="balanceAfter"
              title="变化后现存"
            /><a-table-column data-index="createdAt" title="时间" />
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-spin>

    <a-modal
      v-model:open="actionOpen"
      ok-text="确认过账"
      title="库存操作"
      @ok="submitAction"
    >
      <a-form layout="vertical">
        <a-form-item label="商品 SKU">
          <a-select
            v-model:value="action.tenantSkuId"
            show-search
            :options="
              balances.map((item) => ({
                label: `${item.name} / ${item.skuCode}`,
                value: item.tenantSkuId,
              }))
            "
          />
        </a-form-item>
        <a-form-item v-if="action.type !== 'stocktake'" label="数量">
          <a-input-number v-model:value="action.quantity" :min="1" />
        </a-form-item>
        <a-form-item v-if="action.type === 'stocktake'" label="实盘数量">
          <a-input-number v-model:value="action.countedQuantity" :min="0" />
        </a-form-item>
        <a-form-item v-if="action.type === 'adjustment'" label="调整方向">
          <a-radio-group v-model:value="action.direction">
            <a-radio value="in">增加</a-radio
            ><a-radio value="out">减少</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="action.type === 'inbound'" label="单位成本">
          <a-input v-model:value="action.unitCost" prefix="¥" />
        </a-form-item>
        <a-form-item v-if="action.type === 'transfer'" label="目标门店 ID">
          <a-input v-model:value="action.targetTenantId" />
        </a-form-item>
        <a-form-item label="原因/备注">
          <a-textarea v-model:value="action.remark" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="skuOpen"
      ok-text="创建"
      title="新增门店 SKU"
      @ok="createSku"
    >
      <a-form layout="vertical">
        <a-form-item label="平台商品">
          <a-select
            v-model:value="skuForm.productItemId"
            show-search
            :options="
              products.map((item) => ({
                label: `${item.name} / ${item.category}`,
                value: item.id,
              }))
            "
          />
        </a-form-item>
        <a-form-item label="SKU 编码">
          <a-input v-model:value="skuForm.skuCode" />
        </a-form-item>
        <a-form-item label="条码">
          <a-input v-model:value="skuForm.barcode" />
        </a-form-item>
        <a-form-item label="售价">
          <a-input v-model:value="skuForm.salePrice" prefix="¥" />
        </a-form-item>
        <a-form-item label="预警库存">
          <a-input-number v-model:value="skuForm.lowStockThreshold" :min="0" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="skuForm.trackInventory">
            跟踪库存
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
