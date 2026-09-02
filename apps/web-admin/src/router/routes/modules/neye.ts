import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      authority: ['admin'],
      hideInMenu: true,
      icon: 'lucide:user',
      keepAlive: false,
      title: '个人中心',
    },
  },
  {
    name: 'NEyeProductItems',
    path: '/neye/product-items',
    component: () => import('#/views/neye/product-items/index.vue'),
    meta: {
      authority: ['admin'],
      icon: 'lucide:tags',
      keepAlive: false,
      order: 9,
      title: '商品字典',
    },
  },
  {
    meta: {
      authority: ['admin'],
      icon: 'lucide:settings',
      order: 10,
      title: '平台管理',
    },
    name: 'NEyeSystem',
    path: '/neye/system',
    redirect: '/neye/system/tenants',
    children: [
      {
        name: 'NEyeAdminDashboard',
        path: 'dashboard',
        component: () => import('#/views/neye/system/dashboard.vue'),
        meta: { icon: 'lucide:gauge', keepAlive: false, title: '管理总览' },
      },
      {
        name: 'NEyeTenants',
        path: 'tenants',
        component: () => import('#/views/neye/system/tenants.vue'),
        meta: {
          icon: 'lucide:building-2',
          keepAlive: false,
          title: '商家管理',
        },
      },
      {
        name: 'NEyeUsers',
        path: 'users',
        component: () => import('#/views/neye/system/users.vue'),
        meta: { icon: 'lucide:user-cog', keepAlive: false, title: '账号管理' },
      },
      {
        name: 'NEyeImportTasks',
        path: 'import-tasks',
        component: () => import('#/views/neye/system/import-tasks/index.vue'),
        meta: { icon: 'lucide:upload', keepAlive: false, title: '导入任务' },
      },
      {
        name: 'NEyeWechatSettings',
        path: 'wechat-settings',
        component: () => import('#/views/neye/system/wechat-settings.vue'),
        meta: {
          icon: 'lucide:scan-line',
          keepAlive: false,
          title: '微信小程序设置',
        },
      },
      {
        name: 'NEyeAdminCommerce',
        path: 'commerce',
        component: () => import('#/views/neye/system/commerce/index.vue'),
        meta: {
          icon: 'lucide:badge-dollar-sign',
          keepAlive: false,
          title: '收银与支付',
        },
      },
      {
        name: 'NEyeEventLogs',
        path: 'event-logs',
        component: () => import('#/views/neye/system/event-logs.vue'),
        meta: {
          icon: 'lucide:scroll-text',
          keepAlive: false,
          title: '日志中心',
        },
      },
      {
        name: 'NEyeSystemStatus',
        path: 'system-status',
        component: () => import('#/views/neye/system/system-status.vue'),
        meta: { icon: 'lucide:activity', keepAlive: false, title: '系统状态' },
      },
      {
        name: 'NEyeTenantDetail',
        path: 'tenants/:id',
        component: () => import('#/views/neye/system/tenant-detail.vue'),
        meta: {
          activePath: '/neye/system/tenants',
          hideInMenu: true,
          keepAlive: false,
          title: '商家详情',
        },
      },
    ],
  },
];

export default routes;
