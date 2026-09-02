import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'NoTenant',
    path: '/no-tenant',
    component: () => import('#/views/_core/fallback/no-tenant.vue'),
    meta: {
      authority: ['staff'],
      hideInMenu: true,
      keepAlive: false,
      title: '暂无可用门店',
    },
  },
  {
    name: 'Profile',
    path: '/profile',
    component: () => import('#/views/_core/profile/index.vue'),
    meta: {
      authority: ['staff'],
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
      authority: ['customer.read'],
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
      authority: ['customer.read'],
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
      authority: ['optometry.read'],
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
      authority: ['optometry.read'],
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
      authority: ['fitting.read'],
      icon: 'lucide:receipt-text',
      keepAlive: false,
      order: -2,
      title: '配镜单',
    },
  },
  {
    meta: {
      authority: ['checkout.read', 'inventory.read'],
      icon: 'lucide:shopping-cart',
      order: -1,
      title: '收银与库存',
    },
    name: 'NEyeCommerce',
    path: '/neye/commerce',
    redirect: '/neye/commerce/checkout',
    children: [
      {
        name: 'NEyeCheckout',
        path: 'checkout',
        component: () => import('#/views/neye/commerce/checkout.vue'),
        meta: {
          authority: ['checkout.read'],
          icon: 'lucide:scan-barcode',
          keepAlive: false,
          title: '配镜收银',
        },
      },
      {
        name: 'NEyeSales',
        path: 'sales',
        component: () => import('#/views/neye/commerce/sales.vue'),
        meta: {
          authority: ['checkout.read'],
          icon: 'lucide:receipt',
          keepAlive: false,
          title: '销售与收退款',
        },
      },
      {
        name: 'NEyeInventory',
        path: 'inventory',
        component: () => import('#/views/neye/commerce/inventory.vue'),
        meta: {
          authority: ['inventory.read'],
          icon: 'lucide:warehouse',
          keepAlive: false,
          title: '库存管理',
        },
      },
    ],
  },
  {
    name: 'NEyeFittingDetail',
    path: '/neye/fitting-orders/:id',
    component: () => import('#/views/neye/fitting-orders/detail.vue'),
    meta: {
      activePath: '/neye/fitting-orders',
      authority: ['fitting.read'],
      hideInMenu: true,
      keepAlive: false,
      title: '配镜单详情',
    },
  },
  {
    meta: {
      authority: ['commerce.settings', 'optometry.read'],
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
          authority: ['optometry.read'],
          icon: 'lucide:layout-template',
          keepAlive: false,
          title: '验光单样式',
        },
      },
      {
        name: 'NEyeCommerceSettings',
        path: 'commerce',
        component: () => import('#/views/neye/commerce/settings.vue'),
        meta: {
          authority: ['commerce.settings'],
          icon: 'lucide:settings-2',
          keepAlive: false,
          title: '商业设置',
        },
      },
    ],
  },
  {
    name: 'NEyeOptometryStyleLegacy',
    path: '/neye/system/optometry-style',
    redirect: '/neye/store-settings/optometry-style',
    meta: {
      authority: ['optometry.read'],
      hideInMenu: true,
      title: '验光单样式',
    },
  },
];

export default routes;
