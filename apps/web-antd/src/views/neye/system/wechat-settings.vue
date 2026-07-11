<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import { apiRequest } from '#/api/neye';

type WechatEnvVersion = 'develop' | 'release' | 'trial';

interface WechatAuthSettings {
  enabled: boolean;
  appId: string;
  appSecret: string;
  envVersion: WechatEnvVersion;
  secretConfigured: boolean;
}

const loading = ref(false);
const saving = ref(false);
const envVersionOptions = [
  { label: '正式版', value: 'release' },
  { label: '体验版', value: 'trial' },
  { label: '开发版', value: 'develop' },
];
const form = reactive({
  enabled: false,
  appId: '',
  appSecret: '',
  envVersion: 'release' as WechatEnvVersion,
  clearSecret: false,
  secretConfigured: false,
});

function applySettings(settings: WechatAuthSettings) {
  form.enabled = settings.enabled;
  form.appId = settings.appId;
  form.appSecret = settings.appSecret;
  form.envVersion = settings.envVersion;
  form.secretConfigured = settings.secretConfigured;
  form.clearSecret = false;
}

async function load() {
  loading.value = true;
  try {
    applySettings(
      await apiRequest<WechatAuthSettings>('/system-settings/wechat-auth'),
    );
  } catch (error) {
    message.error(error instanceof Error ? error.message : '微信设置加载失败');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
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
    saving.value = false;
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
        <p class="neye-page-subtitle">
          配置小程序自动登录和 Web 扫码登录。
        </p>
      </div>
      <a-button type="primary" :loading="saving" @click="save">
        保存设置
      </a-button>
    </div>

    <a-spin :spinning="loading">
      <section class="neye-panel wechat-settings">
        <a-form layout="vertical">
          <a-form-item label="启用微信登录">
            <a-switch v-model:checked="form.enabled" />
          </a-form-item>

          <a-form-item label="微信小程序 AppID" required>
            <a-input
              v-model:value="form.appId"
              :maxlength="64"
              placeholder="wx..."
            />
          </a-form-item>

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
              <a-tag :color="form.secretConfigured ? 'green' : 'default'">
                {{ form.secretConfigured ? '已保存到数据库' : '尚未配置' }}
              </a-tag>
            </div>
          </a-form-item>

          <a-form-item v-if="form.secretConfigured">
            <a-checkbox
              v-model:checked="form.clearSecret"
              @change="handleClearSecret(form.clearSecret)"
            >
              清除已保存的 AppSecret
            </a-checkbox>
          </a-form-item>

          <a-form-item label="小程序码打开版本">
            <a-segmented
              v-model:value="form.envVersion"
              :options="envVersionOptions"
            />
          </a-form-item>
        </a-form>

        <a-alert
          type="warning"
          show-icon
          message="明文存储说明"
          description="AppSecret 将以明文保存在数据库 system_settings 中，并在仅管理员可访问的设置页面回显。请严格限制数据库和管理员账号权限。"
        />
      </section>
    </a-spin>
  </div>
</template>

<style src="../neye.css"></style>
<style scoped>
.wechat-settings {
  max-width: 720px;
}

.secret-status {
  margin-top: 10px;
}
</style>
