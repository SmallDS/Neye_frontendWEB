<script setup lang="ts">
import type {
  CommercePermission,
  CommerceSettings,
  PageResult,
  PaymentAccount,
  Tenant,
  TenantPermissionGroup,
  TenantUser,
} from '#/api/neye';

import { onMounted, reactive, ref, watch } from 'vue';

import { message } from 'ant-design-vue';

import {
  adminCommerceApi,
  apiRequest,
  neyeLabel,
  tenantPermissionGroups,
} from '#/api/neye';

defineOptions({ name: 'NEyeAdminCommerce' });

const loading = ref(false);
const tenants = ref<Tenant[]>([]);
const tenantId = ref('');
const settings = ref<CommerceSettings>();
const templates = ref<Record<string, CommercePermission[]>>({});
const permissionGroups = ref<TenantPermissionGroup[]>(tenantPermissionGroups);
const users = ref<Array<TenantUser & { permissions?: CommercePermission[] }>>(
  [],
);
const accounts = ref<PaymentAccount[]>([]);
const settlements = ref<Array<Record<string, any>>>([]);
const settlementEligible = ref<Array<Record<string, any>>>([]);
const settlementEligibleAmount = ref('0.00');
const accountOpen = ref(false);
const settlementOpen = ref(false);
const accountForm = reactive({
  collectionMode: 'direct',
  configText: '{\n  "appId": "",\n  "privateKey": ""\n}',
  displayName: '',
  merchantRef: '',
  provider: 'wechat',
});
const settlementForm = reactive({
  referenceNo: '',
  remark: '',
  transactionIds: '',
});

async function loadBase() {
  loading.value = true;
  try {
    const [tenantResult, permissionResult, accountResult, settlementResult] =
      await Promise.all([
        apiRequest<PageResult<Tenant>>('/tenants?pageSize=100'),
        adminCommerceApi.getPermissions(),
        adminCommerceApi.listPaymentAccounts(),
        adminCommerceApi.listSettlements(),
      ]);
    tenants.value = tenantResult.items;
    permissionGroups.value = permissionResult.groups?.length
      ? permissionResult.groups
      : tenantPermissionGroups;
    templates.value = permissionResult.templates;
    accounts.value = accountResult.items;
    settlements.value = settlementResult.items;
    if (!tenantId.value) tenantId.value = tenants.value[0]?.id ?? '';
  } catch (error) {
    message.error(error instanceof Error ? error.message : '商业管理加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadTenant() {
  if (!tenantId.value) return;
  loading.value = true;
  try {
    const [commerce, tenantUsers, eligible] = await Promise.all([
      adminCommerceApi.getTenantSettings(tenantId.value),
      apiRequest<{
        items: Array<TenantUser & { permissions?: CommercePermission[] }>;
      }>(`/tenants/${tenantId.value}/users`),
      adminCommerceApi.listSettlementEligible(tenantId.value),
    ]);
    settings.value = commerce;
    users.value = tenantUsers.items;
    settlementEligible.value = eligible.items;
    settlementEligibleAmount.value = eligible.settlementAmount;
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '门店商业配置加载失败',
    );
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  if (!tenantId.value || !settings.value) return;
  try {
    settings.value = await adminCommerceApi.updateTenantSettings(
      tenantId.value,
      {
        commerceEnabled: settings.value.commerceEnabled,
        paymentMode: settings.value.paymentMode,
      },
    );
    message.success('门店商业设置已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
  }
}

async function savePermissions(
  user: TenantUser & { permissions?: CommercePermission[] },
) {
  if (!tenantId.value) return;
  try {
    await adminCommerceApi.assignPermissions(
      tenantId.value,
      user.id,
      user.permissions ?? [],
    );
    message.success(`${user.displayName} 的门店权限已更新`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '权限保存失败');
  }
}

function applyTemplate(
  user: TenantUser & { permissions?: CommercePermission[] },
  name: string,
) {
  user.permissions = [...(templates.value[name] ?? [])];
}

async function createAccount() {
  try {
    const config = JSON.parse(accountForm.configText);
    await adminCommerceApi.createPaymentAccount({
      ...accountForm,
      config,
      tenantId:
        accountForm.collectionMode === 'direct' ? tenantId.value : undefined,
    });
    accountOpen.value = false;
    message.success('支付账户版本已加密保存');
    await loadBase();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '支付账户创建失败');
  }
}

async function createSettlement() {
  if (!tenantId.value) return;
  try {
    await adminCommerceApi.createSettlement({
      referenceNo: settlementForm.referenceNo,
      remark: settlementForm.remark,
      tenantId: tenantId.value,
      transactionIds: settlementForm.transactionIds
        .split(/[\s,]+/)
        .filter(Boolean),
    });
    settlementOpen.value = false;
    message.success('人工结算批次已登记');
    await loadBase();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '结算登记失败');
  }
}

watch(tenantId, loadTenant);
onMounted(loadBase);
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">收银与支付</h1>
        <p class="neye-page-subtitle">
          逐店启用商业能力，配置员工权限、正式支付账户与人工结算。
        </p>
      </div>
      <a-select
        v-model:value="tenantId"
        show-search
        style="width: 280px"
        :options="
          tenants.map((item) => ({
            label: `${item.name} / ${item.code}`,
            value: item.id,
          }))
        "
      />
    </div>
    <a-spin :spinning="loading">
      <a-tabs>
        <a-tab-pane key="store" tab="门店商业设置">
          <section v-if="settings" class="neye-panel form-panel">
            <a-form layout="vertical">
              <a-form-item label="商业功能">
                <a-switch
                  v-model:checked="settings.commerceEnabled"
                  checked-children="启用"
                  un-checked-children="关闭"
                />
              </a-form-item>
              <a-form-item label="线上收款归集">
                <a-radio-group v-model:value="settings.paymentMode">
                  <a-radio value="direct">门店独立直收</a-radio
                  ><a-radio value="platform"> 平台统一代收 </a-radio>
                </a-radio-group>
              </a-form-item>
              <a-button type="primary" @click="saveSettings">保存设置</a-button>
            </a-form>
          </section>
        </a-tab-pane>
        <a-tab-pane key="permissions" tab="员工门店权限">
          <a-alert
            class="permission-hint"
            message="权限按“账号 × 门店”单独生效；员工切换门店后只会看到当前门店已分配的功能。"
            show-icon
            type="info"
          />
          <a-table :data-source="users" row-key="id" :pagination="false">
            <a-table-column data-index="displayName" title="员工" width="150" />
            <a-table-column title="权限模板" width="240">
              <template #default="{ record }">
                <a-space>
                  <a-button
                    size="small"
                    @click="applyTemplate(record, 'clerk')"
                  >
                    店员 </a-button
                  ><a-button
                    size="small"
                    @click="applyTemplate(record, 'inventory')"
                  >
                    库存员 </a-button
                  ><a-button
                    size="small"
                    @click="applyTemplate(record, 'manager')"
                  >
                    经理
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
            <a-table-column title="逐项权限">
              <template #default="{ record }">
                <div class="permission-groups">
                  <div
                    v-for="group in permissionGroups"
                    :key="group.key"
                    class="permission-group"
                  >
                    <div class="permission-group-title">{{ group.label }}</div>
                    <a-checkbox-group
                      v-model:value="record.permissions"
                      :options="
                        group.permissions.map((value) => ({
                          label: neyeLabel(value),
                          value,
                        }))
                      "
                    />
                  </div>
                </div>
              </template>
            </a-table-column>
            <a-table-column title="操作" width="100">
              <template #default="{ record }">
                <a-button type="link" @click="savePermissions(record)">
                  保存
                </a-button>
              </template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="accounts" tab="平台支付">
          <div class="tab-actions">
            <a-button type="primary" @click="accountOpen = true">
              新增支付账户版本
            </a-button>
          </div>
          <a-table :data-source="accounts" row-key="id">
            <a-table-column
              data-index="displayName"
              title="名称"
            /><a-table-column data-index="provider" title="渠道">
              <template #default="{ text }">
                {{ neyeLabel(text) }}
              </template> </a-table-column
            ><a-table-column data-index="collectionMode" title="收款模式">
              <template #default="{ text }">
                {{ neyeLabel(text) }}
              </template> </a-table-column
            ><a-table-column
              data-index="merchantRef"
              title="商户号"
            /><a-table-column
              data-index="version"
              title="版本"
            /><a-table-column data-index="status" title="状态">
              <template #default="{ text }">
                {{ neyeLabel(text) }}
              </template> </a-table-column
            ><a-table-column title="操作">
              <template #default="{ record }">
                <a-button
                  v-if="record.status === 'active'"
                  danger
                  type="link"
                  @click="
                    adminCommerceApi
                      .retirePaymentAccount(record.id)
                      .then(loadBase)
                  "
                >
                  停用
                </a-button>
              </template>
            </a-table-column>
          </a-table>
        </a-tab-pane>
        <a-tab-pane key="settlements" tab="代收结算">
          <a-alert
            class="settlement-alert"
            :message="`当前门店未结代收：¥${settlementEligibleAmount}（${settlementEligible.length} 笔）`"
            type="info"
            show-icon
          />
          <a-table
            :data-source="settlementEligible"
            row-key="id"
            :pagination="false"
          >
            <a-table-column
              data-index="orderNo"
              title="销售单"
            /><a-table-column data-index="type" title="类型">
              <template #default="{ text }">
                {{ neyeLabel(text) }}
              </template> </a-table-column
            ><a-table-column data-index="provider" title="渠道">
              <template #default="{ text }">
                {{ neyeLabel(text) }}
              </template> </a-table-column
            ><a-table-column
              data-index="settlementAmount"
              title="应结金额"
            /><a-table-column data-index="createdAt" title="时间" />
          </a-table>
          <div class="tab-actions">
            <a-button
              type="primary"
              :disabled="!settlementEligible.length"
              @click="
                settlementForm.transactionIds = settlementEligible
                  .map((item) => item.id)
                  .join('\n');
                settlementOpen = true;
              "
            >
              将以上流水登记结算
            </a-button>
          </div>
          <a-table :data-source="settlements" row-key="id">
            <a-table-column
              data-index="batchNo"
              title="批次号"
            /><a-table-column
              data-index="storeName"
              title="门店"
            /><a-table-column
              data-index="amount"
              title="结算金额"
            /><a-table-column
              data-index="paidAt"
              title="打款日期"
            /><a-table-column data-index="referenceNo" title="凭证号" />
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-spin>

    <a-modal
      v-model:open="accountOpen"
      ok-text="加密保存"
      title="新增支付账户版本"
      @ok="createAccount"
    >
      <a-form layout="vertical">
        <a-form-item label="渠道">
          <a-select
            v-model:value="accountForm.provider"
            :options="[
              { label: '微信支付', value: 'wechat' },
              { label: '支付宝', value: 'alipay' },
            ]"
          /> </a-form-item
        ><a-form-item label="收款模式">
          <a-radio-group v-model:value="accountForm.collectionMode">
            <a-radio value="direct">当前门店直收</a-radio
            ><a-radio value="platform">平台统一代收</a-radio>
          </a-radio-group> </a-form-item
        ><a-form-item label="显示名称">
          <a-input v-model:value="accountForm.displayName" /> </a-form-item
        ><a-form-item label="商户号">
          <a-input v-model:value="accountForm.merchantRef" /> </a-form-item
        ><a-form-item label="渠道配置（JSON，加密存储）">
          <a-textarea v-model:value="accountForm.configText" :rows="8" />
        </a-form-item>
      </a-form>
    </a-modal>
    <a-modal
      v-model:open="settlementOpen"
      ok-text="登记结算"
      title="人工结算批次"
      @ok="createSettlement"
    >
      <a-form layout="vertical">
        <a-form-item label="待结支付流水 ID（逗号或换行分隔）">
          <a-textarea
            v-model:value="settlementForm.transactionIds"
            :rows="5"
          /> </a-form-item
        ><a-form-item label="打款凭证号">
          <a-input v-model:value="settlementForm.referenceNo" /> </a-form-item
        ><a-form-item label="备注">
          <a-textarea v-model:value="settlementForm.remark" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style src="../../neye.css"></style>
<style scoped>
.form-panel {
  max-width: 900px;
}

.tab-actions {
  display: flex;
  justify-content: flex-end;
  margin: 12px 0;
}

.settlement-alert {
  margin-bottom: 12px;
}

.permission-hint {
  margin-bottom: 12px;
}

.permission-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.permission-group {
  padding: 8px 10px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
}

.permission-group-title {
  margin-bottom: 6px;
  font-weight: 600;
}

.permission-group :deep(.ant-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.permission-group :deep(.ant-checkbox-wrapper) {
  margin-inline-start: 0;
}

@media (max-width: 1100px) {
  .permission-groups {
    grid-template-columns: 1fr;
  }
}
</style>
