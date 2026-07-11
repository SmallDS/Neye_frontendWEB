import type { RouteRecordRaw } from 'vue-router';

import { mergeRouteModules, traverseTreeValues } from '@vben/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';

// NEye 仅加载业务路由，避免示例模块进入构建产物。
const dynamicRouteFiles = import.meta.glob('./modules/neye.ts', {
  eager: true,
});

const dynamicRoutes: RouteRecordRaw[] = mergeRouteModules(dynamicRouteFiles);
const staticRoutes: RouteRecordRaw[] = [];
const externalRoutes: RouteRecordRaw[] = [];

const routes: RouteRecordRaw[] = [
  ...coreRoutes,
  ...externalRoutes,
  fallbackNotFoundRoute,
];

const coreRouteNames = traverseTreeValues(coreRoutes, (route) => route.name);
const accessRoutes = [...dynamicRoutes, ...staticRoutes];

export { accessRoutes, coreRouteNames, routes };