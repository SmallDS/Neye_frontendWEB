<script setup lang="ts">
import type { CommerceSettings } from '#/api/neye';

import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import { commerceApi } from '#/api/neye';
import { useNeyePermissions } from '#/composables/useNeyePermissions';

defineOptions({ name: 'NEyeCommerceSettings' });

const { can } = useNeyePermissions();

const loading = ref(false);
const paymentStatus = ref<Record<string, any>>();
const form = reactive({
  allowNegativeStock: true,
  electronicReceiptEnabled: true,
  paymentMode: 'direct',
  receiptPaper: '80mm',
  receiptPrintMode: 'ask',
});

async function load() {
  loading.value = true;
  try {
    const [settings, status] = await Promise.all([
      commerceApi.getSettings(),
      commerceApi.getPaymentStatus(),
    ]);
    Object.assign(form, settings);
    paymentStatus.value = status;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '商业设置加载失败');
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!can('commerce.settings'))
    return message.warning('当前账号没有修改商业设置的权限，请联系管理员');
  loading.value = true;
  try {
    await commerceApi.updateSettings({
      allowNegativeStock: form.allowNegativeStock,
      electronicReceiptEnabled: form.electronicReceiptEnabled,
      receiptPaper: form.receiptPaper as CommerceSettings['receiptPaper'],
      receiptPrintMode:
        form.receiptPrintMode as CommerceSettings['receiptPrintMode'],
    });
    message.success('商业设置已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">商业设置</h1>
        <p class="neye-page-subtitle">
          配置负库存、小票和电子小票；支付账户由平台管理员统一管理。
        </p>
      </div>
      <a-button
        v-if="can('commerce.settings')"
        type="primary"
        :loading="loading"
        @click="save"
      >
        保存
      </a-button>
    </div>
    <a-spin :spinning="loading">
      <a-row :gutter="16">
        <a-col :xs="24" :lg="14">
          <section class="neye-panel">
            <a-form layout="vertical">
              <a-form-item label="负库存策略">
                <a-switch
                  v-model:checked="form.allowNegativeStock"
                  checked-children="允许，二次确认"
                  un-checked-children="禁止"
                />
              </a-form-item>
              <a-form-item label="结账后打印">
                <a-radio-group v-model:value="form.receiptPrintMode">
                  <a-radio value="ask">每次询问</a-radio
                  ><a-radio value="auto">自动打开打印</a-radio
                  ><a-radio value="never">从不打印</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-form-item label="打印纸张">
                <a-radio-group v-model:value="form.receiptPaper">
                  <a-radio value="80mm">80mm 小票</a-radio
                  ><a-radio value="a4">A4</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-form-item label="电子小票">
                <a-switch v-model:checked="form.electronicReceiptEnabled" />
              </a-form-item>
              <a-form-item label="线上收款模式">
                <a-tag>
                  {{
                    form.paymentMode === 'platform'
                      ? '平台统一代收'
                      : '门店独立直收'
                  }}
                </a-tag>
                <div class="hint">
                  收款模式由管理员配置；历史退款始终使用原支付账户。
                </div>
              </a-form-item>
            </a-form>
          </section>
        </a-col>
        <a-col :xs="24" :lg="10">
          <section class="neye-panel">
            <h3 class="neye-section-title">支付通道状态</h3>
            <a-descriptions bordered :column="1" size="small">
              <a-descriptions-item label="微信支付">
                {{ paymentStatus?.providers?.wechat ? '已配置' : '未配置' }}
              </a-descriptions-item>
              <a-descriptions-item label="支付宝">
                {{ paymentStatus?.providers?.alipay ? '已配置' : '未配置' }}
              </a-descriptions-item>
            </a-descriptions>
            <a-alert
              class="status-alert"
              message="如需开通或修改线上支付账户，请联系平台管理员。"
              show-icon
              type="info"
            />
          </section>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.hint {
  margin-top: 6px;
  color: #8c8c8c;
}

.status-alert {
  margin-top: 16px;
}
</style>
