<script setup lang="ts">
import type {
  DailyCommerceReport,
  PaymentTransaction,
  SalesOrder,
} from '#/api/neye';

import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import { commerceApi, neyeStatusLabel, neyeTypeLabel } from '#/api/neye';
import { useNeyePermissions } from '#/composables/useNeyePermissions';

defineOptions({ name: 'NEyeSales' });

const { can } = useNeyePermissions();

const loading = ref(false);
const sales = ref<SalesOrder[]>([]);
const payments = ref<PaymentTransaction[]>([]);
const report = ref<DailyCommerceReport>();
const refundOpen = ref(false);
const refundForm = reactive({ amount: '', paymentId: '' });

async function load() {
  loading.value = true;
  try {
    const [saleResult, paymentResult] = await Promise.all([
      commerceApi.listSales(),
      commerceApi.listPayments(),
    ]);
    sales.value = saleResult.items;
    payments.value = paymentResult.items;
    if (can('commerce.reports')) {
      try {
        report.value = await commerceApi.getDailyReport();
      } catch (error) {
        message.warning(
          error instanceof Error ? error.message : '营业日报加载失败',
        );
      }
    } else {
      report.value = undefined;
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '销售数据加载失败');
  } finally {
    loading.value = false;
  }
}

async function complete(record: SalesOrder) {
  if (!can('checkout.create'))
    return message.warning('当前账号没有交付出库权限，请联系管理员');
  try {
    await commerceApi.completeSale(record.id);
    message.success('订单已交付并出库');
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '交付失败');
  }
}

function openRefund(record: PaymentTransaction) {
  if (!can('checkout.refund'))
    return message.warning('当前账号没有退款权限，请联系管理员');
  Object.assign(refundForm, {
    amount: record.amount,
    paymentId: record.id,
  });
  refundOpen.value = true;
}

async function refund() {
  try {
    await commerceApi.refundPayment(refundForm.paymentId, {
      amount: refundForm.amount,
    });
    message.success('退款请求已处理');
    refundOpen.value = false;
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '退款失败');
  }
}

async function printReceipt(record: SalesOrder) {
  const receipt = await commerceApi.getReceipt(record.id);
  const popup = window.open('', '_blank', 'width=520,height=760');
  if (!popup)
    return message.warning('浏览器阻止了打印窗口，请允许弹出窗口后重试');
  popup.document.write(
    `<html><head><title>${receipt.orderNo}</title><style>body{font:14px sans-serif;padding:18px}td{padding:6px;border-bottom:1px dashed #bbb}</style></head><body><h1>${receipt.storeName}</h1><p>${receipt.orderNo}</p><table>${receipt.lines.map((line) => `<tr><td>${line.description}</td><td>${line.quantity}</td><td>¥${line.lineTotal}</td></tr>`).join('')}</table><h2>合计 ¥${receipt.totalAmount}</h2></body></html>`,
  );
  popup.document.close();
  popup.print();
}

onMounted(load);
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">销售与收退款</h1>
        <p class="neye-page-subtitle">
          查看零售及配镜销售单、分次收款、退款和营业日报。
        </p>
      </div>
    </div>
    <a-spin :spinning="loading">
      <a-row v-if="can('commerce.reports')" :gutter="16" class="report-row">
        <a-col :span="6">
          <a-card>
            <a-statistic title="今日销售单" :value="report?.salesCount ?? 0" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              prefix="¥"
              title="销售额"
              :value="report?.salesAmount ?? '0.00'"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              prefix="¥"
              title="退款"
              :value="report?.refundAmount ?? '0.00'"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              prefix="¥"
              title="净收款"
              :value="report?.netCollected ?? '0.00'"
            />
          </a-card>
        </a-col>
      </a-row>
      <a-tabs>
        <a-tab-pane key="sales" tab="销售单">
          <a-table
            :data-source="sales"
            row-key="id"
            :pagination="{ pageSize: 20 }"
          >
            <a-table-column data-index="orderNo" title="销售单号" />
            <a-table-column data-index="source" title="来源">
              <template #default="{ text }">
                {{ text === 'fitting' ? '配镜单' : '独立零售' }}
              </template>
            </a-table-column>
            <a-table-column data-index="totalAmount" title="应收" />
            <a-table-column data-index="netPaidAmount" title="已收" />
            <a-table-column data-index="outstandingAmount" title="欠款" />
            <a-table-column data-index="status" title="状态">
              <template #default="{ text }">
                <a-tag>{{ neyeStatusLabel(text) }}</a-tag>
              </template>
            </a-table-column>
            <a-table-column title="操作" width="180">
              <template #default="{ record }">
                <a-space>
                  <a-button
                    v-if="
                      record.source === 'fitting' &&
                      record.status === 'paid' &&
                      can('checkout.create')
                    "
                    type="link"
                    @click="complete(record)"
                  >
                    交付出库 </a-button
                  ><a-button type="link" @click="printReceipt(record)">
                    打印
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="payments" tab="收退款流水">
          <a-table
            :data-source="payments"
            row-key="id"
            :pagination="{ pageSize: 20 }"
          >
            <a-table-column data-index="createdAt" title="时间" />
            <a-table-column data-index="type" title="类型">
              <template #default="{ text }">
                {{ neyeTypeLabel(text) }}
              </template>
            </a-table-column>
            <a-table-column data-index="provider" title="方式">
              <template #default="{ text }">
                {{ neyeTypeLabel(text) }}
              </template>
            </a-table-column>
            <a-table-column data-index="amount" title="金额" />
            <a-table-column data-index="status" title="状态">
              <template #default="{ text }">
                {{ neyeStatusLabel(text) }}
              </template>
            </a-table-column>
            <a-table-column title="操作">
              <template #default="{ record }">
                <a-button
                  v-if="
                    record.type === 'payment' &&
                    record.status === 'succeeded' &&
                    can('checkout.refund')
                  "
                  type="link"
                  @click="openRefund(record)"
                >
                  退款
                </a-button>
              </template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-spin>
    <a-modal
      v-model:open="refundOpen"
      ok-text="确认退款"
      title="退款"
      @ok="refund"
    >
      <a-form layout="vertical">
        <a-form-item label="退款金额">
          <a-input v-model:value="refundForm.amount" prefix="¥" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.report-row {
  margin-bottom: 14px;
}
</style>
