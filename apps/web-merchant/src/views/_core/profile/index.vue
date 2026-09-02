<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileWechatBinding from './wechat-binding.vue';

const userStore = useUserStore();
const route = useRoute();
const mustChangePassword = computed(() =>
  Boolean(
    (
      userStore.userInfo as
        | (NonNullable<typeof userStore.userInfo> & {
            mustChangePassword?: boolean;
          })
        | null
    )?.mustChangePassword,
  ),
);
const tabsValue = ref(route.query.tab === 'password' ? 'password' : 'basic');
const allTabs = [
  { label: '账户信息', value: 'basic' },
  { label: '修改密码', value: 'password' },
  { label: '微信绑定', value: 'wechat' },
];
const tabs = computed(() =>
  mustChangePassword.value
    ? allTabs.filter((item) => item.value === 'password')
    : allTabs,
);
</script>

<template>
  <a-alert
    v-if="mustChangePassword"
    class="mb-4"
    message="首次登录需要修改密码"
    description="当前账号正在使用初始密码 admin。设置至少 8 位的新密码后才能使用系统。"
    show-icon
    type="warning"
  />
  <Profile
    v-model:model-value="tabsValue"
    title="个人中心"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfilePasswordSetting v-else-if="tabsValue === 'password'" />
      <ProfileWechatBinding v-else-if="tabsValue === 'wechat'" />
    </template>
  </Profile>
</template>
