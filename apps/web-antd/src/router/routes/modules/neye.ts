import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      authority: ['admin', 'staff'],
      icon: 'lucide:store',
      order: -2,
      title: '眼镜店业务',
    },
    name: 'NEyeStore',
    path: '/neye',
    redirect: '/neye/customers',
    children: [
      {
        name: 'NEyeCustomers',
        path: 'customers',
        component: () => import('#/views/neye/customers/index.vue'),
        meta: { icon: 'lucide:users', keepAlive: false, title: '客户管理' },
      },
      {
        name: 'NEyeCustomerDetail',
        path: 'customers/:id',
        component: () => import('#/views/neye/customers/detail.vue'),
        meta: {
          activePath: '/neye/customers',
          hideInMenu: true,
          keepAlive: false,
          title: '客户详情',
        },
      },
      {
        name: 'NEyeOptometryOrders',
        path: 'optometry-orders',
        component: () => import('#/views/neye/optometry-orders/index.vue'),
        meta: { icon: 'lucide:eye', keepAlive: false, title: '验光单' },
      },
      {
        name: 'NEyeOptometryDetail',
        path: 'optometry-orders/:id',
        component: () => import('#/views/neye/optometry-orders/detail.vue'),
        meta: {
          activePath: '/neye/optometry-orders',
          hideInMenu: true,
          keepAlive: false,
          title: '验光单详情',
        },
      },
      {
        name: 'NEyeFittingOrders',
        path: 'fitting-orders',
        component: () => import('#/views/neye/fitting-orders/index.vue'),
        meta: { icon: 'lucide:receipt-text', keepAlive: false, title: '配镜单' },
      },
      {
        name: 'NEyeFittingDetail',
        path: 'fitting-orders/:id',
        component: () => import('#/views/neye/fitting-orders/detail.vue'),
        meta: {
          activePath: '/neye/fitting-orders',
          hideInMenu: true,
          keepAlive: false,
          title: '配镜单详情',
        },
      },
      {
        name: 'NEyeProductItems',
        path: 'product-items',
        component: () => import('#/views/neye/product-items/index.vue'),
        meta: { icon: 'lucide:tags', keepAlive: false, title: '商品字典' },
      },
    ],
  },
  {
    meta: {
      authority: ['admin'],
      icon: 'lucide:settings',
      order: -3,
      title: '系统管理',
    },
    name: 'NEyeSystem',
    path: '/neye/system',
    redirect: '/neye/system/tenants',
    children: [
      {
        name: 'NEyeTenants',
        path: 'tenants',
        component: () => import('#/views/neye/system/tenants.vue'),
        meta: { icon: 'lucide:building-2', keepAlive: false, title: '租户管理' },
      },
      {
        name: 'NEyeImportTasks',
        path: 'import-tasks',
        component: () => import('#/views/neye/system/import-tasks.vue'),
        meta: { icon: 'lucide:upload', keepAlive: false, title: '导入任务' },
      },
      {
        name: 'NEyeOptometryStyle',
        path: 'optometry-style',
        component: () => import('#/views/neye/system/optometry-style.vue'),
        meta: { icon: 'lucide:layout-template', keepAlive: false, title: '验光单样式' },
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