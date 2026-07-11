<script setup lang="ts">
import { ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import ProfileBase from './base-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileWechatBinding from './wechat-binding.vue';

const userStore = useUserStore();
const tabsValue = ref('basic');
const tabs = [
  { label: '账户信息', value: 'basic' },
  { label: '修改密码', value: 'password' },
  { label: '微信绑定', value: 'wechat' },
];
</script>

<template>
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
