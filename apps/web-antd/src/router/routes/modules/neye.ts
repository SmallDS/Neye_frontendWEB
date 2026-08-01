import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      authority: ['admin', 'staff'],
      hideInMenu: true,
      icon: 'lucide:user',
      keepAlive: false,
      title: '个人中心',
    },
  },
  {
    name: 'NEyeCustomers',
    path: '/neye/customers',
    component: () => import('#/views/neye/customers/index.vue'),
    meta: {
      authority: ['admin', 'staff'],
      fullPathKey: false,
      icon: 'lucide:users',
      keepAlive: false,
      order: -4,
      title: '客户管理',
    },
  },
  {
    name: 'NEyeCustomerDetail',
    path: '/neye/customers/:id',
    component: () => import('#/views/neye/customers/detail.vue'),
    meta: {
      activePath: '/neye/customers',
      authority: ['admin', 'staff'],
      hideInMenu: true,
      fullPathKey: false,
      keepAlive: false,
      title: '客户详情',
    },
  },
  {
    name: 'NEyeOptometryOrders',
    path: '/neye/optometry-orders',
    component: () => import('#/views/neye/optometry-orders/index.vue'),
    meta: {
      authority: ['admin', 'staff'],
      icon: 'lucide:eye',
      keepAlive: false,
      order: -3,
      title: '验光单',
    },
  },
  {
    name: 'NEyeOptometryDetail',
    path: '/neye/optometry-orders/:id',
    component: () => import('#/views/neye/optometry-orders/detail.vue'),
    meta: {
      activePath: '/neye/optometry-orders',
      authority: ['admin', 'staff'],
      hideInMenu: true,
      keepAlive: false,
      title: '验光单详情',
    },
  },
  {
    name: 'NEyeFittingOrders',
    path: '/neye/fitting-orders',
    component: () => import('#/views/neye/fitting-orders/index.vue'),
    meta: {
      authority: ['admin', 'staff'],
      icon: 'lucide:receipt-text',
      keepAlive: false,
      order: -2,
      title: '配镜单',
    },
  },
  {
    name: 'NEyeFittingDetail',
    path: '/neye/fitting-orders/:id',
    component: () => import('#/views/neye/fitting-orders/detail.vue'),
    meta: {
      activePath: '/neye/fitting-orders',
      authority: ['admin', 'staff'],
      hideInMenu: true,
      keepAlive: false,
      title: '配镜单详情',
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
      order: -1,
      title: '商品字典',
    },
  },
  {
    meta: {
      authority: ['admin', 'staff'],
      icon: 'lucide:store',
      order: 9,
      title: '门店设置',
    },
    name: 'NEyeStoreSettings',
    path: '/neye/store-settings',
    redirect: '/neye/store-settings/optometry-style',
    children: [
      {
        name: 'NEyeOptometryStyle',
        path: 'optometry-style',
        component: () => import('#/views/neye/system/optometry-style.vue'),
        meta: {
          icon: 'lucide:layout-template',
          keepAlive: false,
          title: '验光单样式',
        },
      },
    ],
  },
  {
    name: 'NEyeOptometryStyleLegacy',
    path: '/neye/system/optometry-style',
    redirect: '/neye/store-settings/optometry-style',
    meta: {
      authority: ['admin', 'staff'],
      hideInMenu: true,
      title: '验光单样式',
    },
  },
  {
    meta: {
      authority: ['admin'],
      icon: 'lucide:settings',
      order: 10,
      title: '系统管理',
    },
    name: 'NEyeSystem',
    path: '/neye/system',
    redirect: '/neye/system/dashboard',
    children: [
      {
        name: 'NEyeAdminDashboard',
        path: 'dashboard',
        component: () => import('#/views/neye/system/dashboard.vue'),
        meta: {
          icon: 'lucide:gauge',
          keepAlive: false,
          title: '管理总览',
        },
      },
      {
        name: 'NEyeSystemStatus',
        path: 'system-status',
        component: () => import('#/views/neye/system/system-status.vue'),
        meta: {
          icon: 'lucide:activity',
          keepAlive: false,
          title: '系统状态',
        },
      },
      {
        name: 'NEyeUsers',
        path: 'users',
        component: () => import('#/views/neye/system/users.vue'),
        meta: {
          icon: 'lucide:user-cog',
          keepAlive: false,
          title: '账号管理',
        },
      },
      {
        name: 'NEyeTenants',
        path: 'tenants',
        component: () => import('#/views/neye/system/tenants.vue'),
        meta: {
          icon: 'lucide:building-2',
          keepAlive: false,
          title: '租户管理',
        },
      },
      {
        name: 'NEyeEventLogs',
        path: 'event-logs',
        component: () => import('#/views/neye/system/event-logs.vue'),
        meta: {
          authority: ['admin'],
          icon: 'lucide:scroll-text',
          keepAlive: false,
          title: '日志中心',
        },
      },
      {
        name: 'NEyeImportTasks',
        path: 'import-tasks',
        component: () => import('#/views/neye/system/import-tasks.vue'),
        meta: {
          icon: 'lucide:upload',
          keepAlive: false,
          title: '导入任务',
        },
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
        name: 'NEyeTenantDetail',
        path: 'tenants/:id',
        component: () => import('#/views/neye/system/tenant-detail.vue'),
        meta: {
          activePath: '/neye/system/tenants',
          hideInMenu: true,
          keepAlive: false,
          title: '租户详情',
        },
      },
    ],
  },
];

export default routes;
