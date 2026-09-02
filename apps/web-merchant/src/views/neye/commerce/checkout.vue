<script setup lang="ts">
import type {
  CommerceSettings,
  FittingCheckoutQueueItem,
  FittingCheckoutQueueState,
  PaymentIntent,
  SalesLine,
  SalesOrder,
  TenantSku,
} from '#/api/neye';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { message, Modal } from 'ant-design-vue';

import { commerceApi, neyeStatusLabel } from '#/api/neye';
import { useNeyePermissions } from '#/composables/useNeyePermissions';

defineOptions({ name: 'NEyeCheckout' });
type CartLine = SalesLine & { key: string };
const route = useRoute();
const router = useRouter();
const { can } = useNeyePermissions();
const loading = ref(false);
const settings = ref<CommerceSettings>();
const queue = ref<FittingCheckoutQueueItem[]>([]);
const queueTotal = ref(0);
const queueState = ref<FittingCheckoutQueueState>('pending');
const keyword = ref('');
const page = ref(1);
const pageSize = 12;
const currentSale = ref<SalesOrder>();
const currentIntent = ref<PaymentIntent>();
const paymentOpen = ref(false);
const retailOpen = ref(false);
const skus = ref<TenantSku[]>([]);
const cart = ref<CartLine[]>([]);
const barcode = ref('');
const retailKeyword = ref('');
const paymentForm = reactive({
  amount: '',
  interaction: 'manual',
  provider: 'cash',
});
const filteredSkus = computed(() => {
  const value = retailKeyword.value.trim().toLowerCase();
  return value
    ? skus.value.filter((item) =>
        `${item.name} ${item.skuCode} ${item.barcode ?? ''}`
          .toLowerCase()
          .includes(value),
      )
    : skus.value;
});
const retailTotal = computed(() =>
  cart.value
    .reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0)
    .toFixed(2),
);

function statusLabel(item: FittingCheckoutQueueItem) {
  return item.saleStatus === 'paid' && !item.readyForPickupAt
    ? '已结清制作中'
    : neyeStatusLabel(item.saleStatus);
}
function statusColor(item: FittingCheckoutQueueItem) {
  if (item.saleStatus === 'refund_due') return 'red';
  if (item.saleStatus === 'paid') return 'green';
  if (item.saleStatus === 'partially_paid') return 'orange';
  return 'blue';
}
async function loadQueue() {
  loading.value = true;
  try {
    const result = await commerceApi.listFittingCheckoutQueue({
      keyword: keyword.value,
      page: page.value,
      pageSize,
      state: queueState.value,
    });
    queue.value = result.items;
    queueTotal.value = result.total;
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '配镜收银队列加载失败',
    );
  } finally {
    loading.value = false;
  }
}
async function load() {
  loading.value = true;
  try {
    settings.value = await commerceApi.getSettings();
    const saleId =
      typeof route.query.saleId === 'string' ? route.query.saleId : '';
    if (saleId) {
      let sale = await commerceApi.getSale(saleId);
      if (sale.status === 'draft' && can('checkout.create'))
        sale = await commerceApi.confirmSale(sale.id);
      currentSale.value = sale;
      if (Number(sale.outstandingAmount) > 0 && can('checkout.collect'))
        openPayment(sale);
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '收银台加载失败');
  } finally {
    loading.value = false;
  }
  await loadQueue();
}
function openPayment(sale: SalesOrder) {
  currentSale.value = sale;
  paymentForm.amount = sale.outstandingAmount;
  paymentForm.provider = 'cash';
  paymentForm.interaction = 'manual';
  paymentOpen.value = true;
}
async function startCheckout(item: FittingCheckoutQueueItem) {
  if (item.saleStatus === 'refund_due') {
    await router.push('/neye/commerce/sales');
    return;
  }
  if (!item.saleId && !can('checkout.create'))
    return message.warning('当前账号没有开单权限，请联系管理员');
  loading.value = true;
  try {
    let sale = item.saleId
      ? await commerceApi.getSale(item.saleId)
      : await commerceApi.createFittingSale(item.fittingOrderId);
    if (sale.status === 'draft') {
      if (!can('checkout.create'))
        return message.warning('当前账号没有确认开单权限，请联系管理员');
      sale = await commerceApi.confirmSale(sale.id);
    }
    currentSale.value = sale;
    if (sale.status === 'paid') {
      message.success('该配镜单已结清，等待取镜交付');
    } else if (can('checkout.collect')) openPayment(sale);
    else message.info('当前账号仅可查看收银记录，没有收款权限');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '进入配镜收银失败');
  } finally {
    loading.value = false;
  }
}
async function collect() {
  if (!currentSale.value || !can('checkout.collect'))
    return message.warning('当前账号没有收款权限，请联系管理员');
  loading.value = true;
  try {
    currentIntent.value = await commerceApi.createPayment(
      currentSale.value.id,
      paymentForm,
    );
    currentSale.value = await commerceApi.getSale(currentSale.value.id);
    if (currentIntent.value.status !== 'succeeded')
      return message.info(
        `支付状态：${neyeStatusLabel(currentIntent.value.status)}`,
      );
    if (
      currentSale.value.source === 'fitting' &&
      currentSale.value.status === 'paid'
    ) {
      paymentOpen.value = false;
      message.success('配镜单已结清，等待取镜交付');
      await offerReceipt();
      await loadQueue();
    } else if (currentSale.value.status === 'completed') {
      paymentOpen.value = false;
      message.success('零售收款完成');
      await offerReceipt();
      cart.value = [];
      retailOpen.value = false;
    } else {
      paymentForm.amount = currentSale.value.outstandingAmount;
      message.success(`收款成功，剩余 ¥${currentSale.value.outstandingAmount}`);
      await loadQueue();
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '收款失败');
  } finally {
    loading.value = false;
  }
}
async function deliver(item: FittingCheckoutQueueItem) {
  if (!item.saleId || !can('checkout.create'))
    return message.warning('当前账号没有交付出库权限，请联系管理员');
  loading.value = true;
  try {
    await commerceApi.completeSale(item.saleId);
    message.success('取镜交付完成，库存已出库');
    await loadQueue();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '交付失败');
  } finally {
    loading.value = false;
  }
}
async function offerReceipt() {
  if (settings.value?.receiptPrintMode === 'auto') await printReceipt();
  else if (settings.value?.receiptPrintMode === 'ask')
    Modal.confirm({
      content: '收款完成，是否立即打印小票？',
      okText: '打印',
      onOk: printReceipt,
      title: '收银完成',
    });
}
async function printReceipt() {
  if (!currentSale.value) return;
  const receipt = await commerceApi.getReceipt(currentSale.value.id);
  const popup = window.open('', '_blank', 'width=520,height=760');
  if (!popup)
    return message.warning('浏览器阻止了打印窗口，请允许弹出窗口后重试');
  const lines = receipt.lines
    .map(
      (line) =>
        `<tr><td>${line.description}</td><td>${line.quantity}</td><td>${line.lineTotal ?? ''}</td></tr>`,
    )
    .join('');
  popup.document.write(
    `<html><head><title>${receipt.orderNo}</title><style>body{font:14px sans-serif;padding:18px}table{width:100%}td{padding:6px 0;border-bottom:1px dashed #ccc}</style></head><body><h2>${receipt.storeName}</h2><div>${receipt.orderNo}</div><table>${lines}</table><h3>合计 ¥${receipt.totalAmount}</h3></body></html>`,
  );
  popup.document.close();
  popup.focus();
  popup.print();
}
async function openRetail() {
  if (!can('checkout.create'))
    return message.warning('当前账号没有临时零售开单权限，请联系管理员');
  retailOpen.value = true;
  if (skus.value.length === 0)
    skus.value = await commerceApi.listSkus().then((result) => result.items);
}
function addSku(item: TenantSku) {
  const existing = cart.value.find((line) => line.tenantSkuId === item.id);
  if (existing) existing.quantity += 1;
  else
    cart.value.push({
      description: item.name,
      key: item.id,
      quantity: 1,
      tenantSkuId: item.id,
      trackInventory: item.trackInventory,
      unitPrice: item.salePrice,
    });
}
function scan() {
  const value = barcode.value.trim();
  if (!value) return;
  const item = skus.value.find(
    (sku) => sku.barcode === value || sku.skuCode === value,
  );
  if (item) addSku(item);
  else message.warning('未找到该条码对应的门店 SKU');
  barcode.value = '';
}
async function createRetail(confirmNegative = false) {
  if (!can('checkout.create'))
    return message.warning('当前账号没有开单权限，请联系管理员');
  if (cart.value.length === 0) return message.warning('请先添加商品');
  loading.value = true;
  try {
    const sale = await commerceApi.createSale({
      lines: cart.value.map(({ key: _key, ...line }) => line),
    });
    const confirmed = await commerceApi.confirmSale(sale.id, confirmNegative);
    if (can('checkout.collect')) openPayment(confirmed);
    else {
      retailOpen.value = false;
      message.success('零售单已创建，请由有收款权限的员工继续收款');
    }
  } catch (error: any) {
    if (
      error?.code === 'INSUFFICIENT_STOCK' &&
      error?.details?.confirmationRequired
    )
      Modal.confirm({
        content: `库存不足 ${error.details.shortage} 件，继续操作将记录库存缺口和操作人。`,
        okText: '确认负库存开单',
        onOk: () => createRetail(true),
        title: '库存不足',
      });
    else message.error(error instanceof Error ? error.message : '零售开单失败');
  } finally {
    loading.value = false;
  }
}
watch(queueState, () => {
  page.value = 1;
  void loadQueue();
});
onMounted(load);
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">配镜收银</h1>
        <p class="neye-page-subtitle">
          从配镜单收取定金和尾款，结清后等待取镜交付。
        </p>
      </div>
      <a-button v-if="can('checkout.create')" @click="openRetail">
        临时零售开单
      </a-button>
    </div>
    <section class="neye-panel queue-toolbar">
      <a-segmented
        v-model:value="queueState"
        :options="[
          { label: '待收款', value: 'pending' },
          { label: '已结清待交付', value: 'paid_for_delivery' },
          { label: '待退款', value: 'refund_due' },
          { label: '全部', value: 'all' },
        ]"
      /><a-input-search
        v-model:value="keyword"
        allow-clear
        placeholder="配镜单号、客户姓名或手机号"
        style="max-width: 360px"
        @search="
          () => {
            page = 1;
            loadQueue();
          }
        "
      />
    </section>
    <a-spin :spinning="loading">
      <a-empty
        v-if="!queue.length"
        class="queue-empty"
        description="当前没有符合条件的配镜单"
      />
      <div v-else class="queue-grid">
        <article
          v-for="item in queue"
          :key="item.fittingOrderId"
          class="neye-panel queue-card"
        >
          <div class="queue-card-head">
            <div>
              <strong>{{ item.customer.name }}</strong
              ><span class="order-no">{{ item.fittingOrderNo }}</span>
            </div>
            <a-tag :color="statusColor(item)">{{ statusLabel(item) }}</a-tag>
          </div>
          <p class="description">{{ item.description || '未填写配镜商品' }}</p>
          <p class="customer-phone">
            {{ item.customer.phone || '未留手机号' }}
          </p>
          <div class="amounts">
            <span
              >应收 <b>¥{{ item.totalAmount }}</b></span
            ><span>已收 ¥{{ item.netPaidAmount }}</span
            ><span v-if="Number(item.outstandingAmount) > 0"
              >待收 <b class="due">¥{{ item.outstandingAmount }}</b></span
            ><span v-if="Number(item.refundDueAmount) > 0"
              >待退 <b class="refund">¥{{ item.refundDueAmount }}</b></span
            >
          </div>
          <div class="queue-actions">
            <a-button
              v-if="
                item.saleStatus === 'paid' &&
                item.readyForPickupAt &&
                can('checkout.create')
              "
              type="primary"
              @click="deliver(item)"
            >
              确认取镜交付 </a-button
            ><a-button
              v-else-if="
                item.saleStatus === 'refund_due' && can('checkout.refund')
              "
              danger
              @click="startCheckout(item)"
            >
              处理退款 </a-button
            ><a-button
              v-else-if="
                Number(item.outstandingAmount) > 0 &&
                can('checkout.collect') &&
                (item.saleId || can('checkout.create'))
              "
              type="primary"
              @click="startCheckout(item)"
            >
              {{
                item.saleStatus === 'not_started' ? '开始收款' : '继续收款'
              }} </a-button
            ><a-button v-else @click="router.push('/neye/commerce/sales')">
              查看销售记录
            </a-button>
          </div>
        </article>
      </div>
      <a-pagination
        v-if="queueTotal > pageSize"
        v-model:current="page"
        :page-size="pageSize"
        :total="queueTotal"
        show-less-items
        @change="loadQueue"
      />
    </a-spin>
    <a-drawer v-model:open="retailOpen" title="临时零售开单" width="720">
      <a-alert
        message="该入口用于无配镜单的临时零售，配镜业务请从收银首页选择配镜单。"
        show-icon
        type="info"
      />
      <div class="retail-search">
        <a-input-search
          v-model:value="barcode"
          autofocus
          placeholder="扫描条码后回车"
          @search="scan"
        /><a-input
          v-model:value="retailKeyword"
          placeholder="搜索商品名称、SKU 或条码"
        />
      </div>
      <a-list :data-source="filteredSkus" :pagination="{ pageSize: 6 }">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta
              :description="`${item.skuCode} · ¥${item.salePrice}`"
              :title="item.name"
            /><a-button type="primary" ghost @click="addSku(item)">
              加入
            </a-button>
          </a-list-item>
        </template> </a-list
      ><a-table
        v-if="cart.length"
        :data-source="cart"
        :pagination="false"
        row-key="key"
        size="small"
      >
        <a-table-column data-index="description" title="商品" /><a-table-column
          title="数量"
          width="100"
        >
          <template #default="{ record }">
            <a-input-number v-model:value="record.quantity" :min="1" />
          </template> </a-table-column
        ><a-table-column title="单价" width="130">
          <template #default="{ record }">
            <a-input
              v-model:value="record.unitPrice"
              prefix="¥"
              :disabled="!can('checkout.override_price')"
            />
          </template> </a-table-column
        ><a-table-column title="操作" width="70">
          <template #default="{ record }">
            <a-button
              danger
              type="link"
              @click="cart = cart.filter((x) => x.key !== record.key)"
            >
              删除
            </a-button>
          </template>
        </a-table-column>
      </a-table>
      <div class="checkout-total">零售应收 ¥{{ retailTotal }}</div>
      <a-button
        block
        size="large"
        type="primary"
        :disabled="!cart.length"
        @click="createRetail(false)"
      >
        确认零售开单{{ can('checkout.collect') ? '并收款' : '' }}
      </a-button>
    </a-drawer>
    <a-modal
      v-model:open="paymentOpen"
      :confirm-loading="loading"
      :ok-button-props="{ disabled: !can('checkout.collect') }"
      ok-text="确认收款"
      title="配镜单收款"
      @ok="collect"
    >
      <p v-if="currentSale" class="sale-summary">
        {{ currentSale.orderNo }} · 应收 ¥{{ currentSale.totalAmount }} · 已收
        ¥{{ currentSale.netPaidAmount }}
      </p>
      <a-form class="payment-form" layout="vertical">
        <a-form-item label="本次收款金额">
          <a-input
            v-model:value="paymentForm.amount"
            prefix="¥"
          /> </a-form-item
        ><a-form-item label="收款方式">
          <a-select
            v-model:value="paymentForm.provider"
            :options="[
              { label: '现金', value: 'cash' },
              { label: '银行卡', value: 'bank_card' },
              { label: '其他线下', value: 'other' },
              { label: '微信支付', value: 'wechat' },
              { label: '支付宝', value: 'alipay' },
            ]"
          /> </a-form-item
        ><a-form-item label="交互方式">
          <a-select
            v-model:value="paymentForm.interaction"
            :options="[
              { label: '线下确认', value: 'manual' },
              { label: '顾客扫二维码', value: 'customer_qr' },
              { label: '扫描顾客付款码', value: 'cashier_scan' },
            ]"
          /> </a-form-item
        ><a-alert
          v-if="currentIntent?.qrCodeUrl"
          message="请顾客使用对应支付应用扫描付款二维码"
          type="info"
        />
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.queue-toolbar {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 16px;
}

.queue-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.queue-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.queue-card-head,
.amounts,
.queue-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.queue-card-head > div {
  display: flex;
  flex-direction: column;
}

.queue-card-head strong {
  font-size: 18px;
}

.order-no,
.customer-phone {
  font-size: 13px;
  color: #8c8c8c;
}

.description {
  min-height: 22px;
  margin: 0;
  color: #595959;
}

.amounts {
  flex-wrap: wrap;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
}

.amounts b {
  font-size: 17px;
}

.due {
  color: #d46b08;
}

.refund {
  color: #cf1322;
}

.queue-actions {
  justify-content: flex-end;
}

.queue-empty {
  padding: 80px 0;
}

.retail-search {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 16px 0;
}

.checkout-total {
  margin: 20px 0;
  font-size: 26px;
  font-weight: 700;
  text-align: right;
}

.payment-form {
  margin-top: 16px;
}

.sale-summary {
  margin-top: 12px;
  color: #595959;
}

@media (max-width: 900px) {
  .queue-grid {
    grid-template-columns: 1fr;
  }

  .queue-toolbar,
  .neye-page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .retail-search {
    grid-template-columns: 1fr;
  }
}
</style>
