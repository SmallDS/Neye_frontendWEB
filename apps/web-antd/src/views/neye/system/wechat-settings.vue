<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import { adminApi, apiRequest } from '#/api/neye';
import type {
  PickupNotificationSource,
  WechatPickupNotificationSettings,
} from '#/types/neye';
import { validatePickupSettings } from '../fitting-orders/pickup-notification';

type WechatEnvVersion = 'develop' | 'release' | 'trial';

interface WechatAuthSettings {
  enabled: boolean;
  appId: string;
  appSecret: string;
  envVersion: WechatEnvVersion;
  secretConfigured: boolean;
}

const loading = ref(false);
const savingAuth = ref(false);
const savingPickup = ref(false);
const envVersionOptions = [
  { label: '正式版', value: 'release' },
  { label: '体验版', value: 'trial' },
  { label: '开发版', value: 'develop' },
];
const sourceLabels: Record<PickupNotificationSource, string> = {
  order_no: '配镜单号',
  store_name: '门店名称',
  store_phone: '门店电话（来自租户联系电话）',
  pickup_tip: '取镜提示',
};
const form = reactive({
  enabled: false,
  appId: '',
  appSecret: '',
  envVersion: 'release' as WechatEnvVersion,
  clearSecret: false,
  secretConfigured: false,
});
const pickupForm = reactive<WechatPickupNotificationSettings>({
  enabled: false,
  templateId: '',
  pickupTip: '您的眼镜已制作完成，请到店取镜。',
  keywordMapping: [
    { keyword: 'character_string1', source: 'order_no' },
    { keyword: 'name2', source: 'store_name' },
    { keyword: 'phone_number3', source: 'store_phone' },
    { keyword: 'thing4', source: 'pickup_tip' },
  ],
  valid: false,
  validationErrors: [],
});

function applySettings(settings: WechatAuthSettings) {
  form.enabled = settings.enabled;
  form.appId = settings.appId;
  form.appSecret = settings.appSecret;
  form.envVersion = settings.envVersion;
  form.secretConfigured = settings.secretConfigured;
  form.clearSecret = false;
}

function applyPickupSettings(settings: WechatPickupNotificationSettings) {
  pickupForm.enabled = settings.enabled;
  pickupForm.templateId = settings.templateId;
  pickupForm.pickupTip = settings.pickupTip;
  pickupForm.keywordMapping = settings.keywordMapping.map((item) => ({
    ...item,
  }));
  pickupForm.valid = settings.valid;
  pickupForm.validationErrors = [...settings.validationErrors];
}

async function load() {
  loading.value = true;
  try {
    const [auth, pickup] = await Promise.all([
      apiRequest<WechatAuthSettings>('/system-settings/wechat-auth'),
      adminApi.getWechatPickupNotification(),
    ]);
    applySettings(auth);
    applyPickupSettings(pickup);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '微信设置加载失败');
  } finally {
    loading.value = false;
  }
}

async function saveAuth() {
  savingAuth.value = true;
  try {
    const settings = await apiRequest<WechatAuthSettings>(
      '/system-settings/wechat-auth',
      {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: form.enabled,
          appId: form.appId.trim(),
          appSecret: form.appSecret.trim(),
          envVersion: form.envVersion,
          clearSecret: form.clearSecret,
        }),
      },
    );
    applySettings(settings);
    message.success('微信登录设置已保存');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '微信设置保存失败');
  } finally {
    savingAuth.value = false;
  }
}

async function savePickup() {
  const errors = validatePickupSettings(pickupForm);
  if (errors.length) {
    message.error(errors[0]);
    return;
  }
  savingPickup.value = true;
  try {
    const saved = await adminApi.updateWechatPickupNotification({
      enabled: pickupForm.enabled,
      templateId: pickupForm.templateId.trim(),
      pickupTip: pickupForm.pickupTip.trim(),
      keywordMapping: pickupForm.keywordMapping.map((item) => ({
        ...item,
        keyword: item.keyword.trim(),
      })),
    });
    applyPickupSettings(saved);
    message.success('取镜通知设置已保存');
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : '取镜通知设置保存失败',
    );
  } finally {
    savingPickup.value = false;
  }
}

function handleSecretInput() {
  if (form.appSecret) form.clearSecret = false;
}

function handleClearSecret(checked: boolean) {
  if (checked) form.appSecret = '';
}

onMounted(() => void load());
</script>

<template>
  <div class="neye-page">
    <div class="neye-page-head">
      <div>
        <h1 class="neye-page-title">微信小程序设置</h1>
        <p class="neye-page-subtitle">配置小程序登录与一次性取镜订阅通知。</p>
      </div>
    </div>

    <a-spin :spinning="loading">
      <section class="neye-panel wechat-settings">
        <div class="setting-head">
          <div>
            <h2 class="neye-section-title">微信登录与小程序码</h2>
            <p class="neye-page-subtitle">AppSecret 不会出现在操作日志中。</p>
          </div>
          <a-button type="primary" :loading="savingAuth" @click="saveAuth"
            >保存登录设置</a-button
          >
        </div>
        <a-form layout="vertical">
          <a-form-item label="启用微信登录"
            ><a-switch v-model:checked="form.enabled"
          /></a-form-item>
          <a-form-item label="微信小程序 AppID" required
            ><a-input
              v-model:value="form.appId"
              :maxlength="64"
              placeholder="wx..."
          /></a-form-item>
          <a-form-item label="微信小程序 AppSecret">
            <a-input-password
              v-model:value="form.appSecret"
              :disabled="form.clearSecret"
              :maxlength="128"
              placeholder="请输入小程序 AppSecret"
              autocomplete="off"
              @input="handleSecretInput"
            />
            <div class="secret-status">
              <a-tag :color="form.secretConfigured ? 'green' : 'default'">{{
                form.secretConfigured ? '已配置' : '尚未配置'
              }}</a-tag>
            </div>
          </a-form-item>
          <a-form-item v-if="form.secretConfigured"
            ><a-checkbox
              v-model:checked="form.clearSecret"
              @change="handleClearSecret(form.clearSecret)"
              >清除已保存的 AppSecret</a-checkbox
            ></a-form-item
          >
          <a-form-item label="小程序码打开版本"
            ><a-segmented
              v-model:value="form.envVersion"
              :options="envVersionOptions"
          /></a-form-item>
        </a-form>
      </section>

      <section class="neye-panel wechat-settings pickup-settings">
        <div class="setting-head">
          <div>
            <h2 class="neye-section-title">取镜一次性订阅通知</h2>
            <p class="neye-page-subtitle">
              关闭时可保存草稿；启用时必须完成全部四项关键词映射。
            </p>
          </div>
          <a-button type="primary" :loading="savingPickup" @click="savePickup"
            >保存通知设置</a-button
          >
        </div>
        <a-form layout="vertical">
          <a-form-item label="启用取镜通知"
            ><a-switch v-model:checked="pickupForm.enabled"
          /></a-form-item>
          <a-form-item
            label="微信订阅消息模板 ID"
            :required="pickupForm.enabled"
            ><a-input
              v-model:value="pickupForm.templateId"
              :maxlength="128"
              placeholder="请输入模板 ID"
          /></a-form-item>
          <a-form-item label="取镜提示" :required="pickupForm.enabled"
            ><a-textarea
              v-model:value="pickupForm.pickupTip"
              :maxlength="200"
              show-count
              :rows="3"
          /></a-form-item>
          <a-form-item label="模板关键词映射" :required="pickupForm.enabled">
            <div
              v-for="item in pickupForm.keywordMapping"
              :key="item.source"
              class="mapping-row"
            >
              <span>{{ sourceLabels[item.source] }}</span>
              <a-input
                v-model:value="item.keyword"
                :maxlength="32"
                placeholder="thing1"
              />
            </div>
          </a-form-item>
        </a-form>
        <a-alert
          v-if="pickupForm.validationErrors.length"
          type="warning"
          show-icon
          message="当前草稿尚不可启用"
          :description="pickupForm.validationErrors.join('；')"
        />
      </section>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.wechat-settings {
  max-width: 760px;
}
.pickup-settings {
  margin-top: 16px;
}
.setting-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.secret-status {
  margin-top: 10px;
}
.mapping-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
</style>
