<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';

import { apiRequest } from '#/api/neye';

type SecretSource = 'database' | 'environment' | 'none';

interface WechatAuthSettings {
  enabled: boolean;
  appId: string;
  secretConfigured: boolean;
  secretSource: SecretSource;
}

const loading = ref(false);
const saving = ref(false);
const form = reactive({
  enabled: false,
  appId: '',
  appSecret: '',
  clearSecret: false,
  secretConfigured: false,
  secretSource: 'none' as SecretSource,
});

function applySettings(settings: WechatAuthSettings) {
  form.enabled = settings.enabled;
  form.appId = settings.appId;
  form.secretConfigured = settings.secretConfigured;
  form.secretSource = settings.secretSource;
  form.appSecret = '';
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
          ...(form.appSecret.trim()
            ? { appSecret: form.appSecret.trim() }
            : {}),
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
              :maxlength="128"
              :placeholder="
                form.secretConfigured
                  ? '留空表示保持当前 AppSecret'
                  : '请输入小程序 AppSecret'
              "
              autocomplete="new-password"
              @input="handleSecretInput"
            />
            <div class="secret-status">
              <a-tag :color="form.secretConfigured ? 'green' : 'default'">
                {{
                  form.secretConfigured
                    ? form.secretSource === 'database'
                      ? '已加密保存到数据库'
                      : '当前来自后端环境变量'
                    : '尚未配置'
                }}
              </a-tag>
            </div>
          </a-form-item>

          <a-form-item v-if="form.secretConfigured">
            <a-checkbox
              v-model:checked="form.clearSecret"
              :disabled="Boolean(form.appSecret)"
            >
              清除已保存的 AppSecret
            </a-checkbox>
          </a-form-item>
        </a-form>

        <a-alert
          type="info"
          show-icon
          message="密钥安全"
          description="AppSecret 保存时会使用 AES-256-GCM 加密，页面与接口均不会回显明文。修改 SETTINGS_ENCRYPTION_KEY 或 JWT_SECRET 前需要先重新保存 AppSecret。"
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
