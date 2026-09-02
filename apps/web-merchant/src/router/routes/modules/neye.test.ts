import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it } from 'vitest';

import routes from './neye';

function flatten(items: RouteRecordRaw[]): RouteRecordRaw[] {
  return items.flatMap((route) => [
    route,
    ...flatten((route.children ?? []) as RouteRecordRaw[]),
  ]);
}

describe('merchant routes', () => {
  it('contains merchant business routes and no platform routes', () => {
    const paths = flatten(routes).map((route) => route.path);
    expect(paths).toContain('/neye/customers');
    expect(paths).toContain('/neye/optometry-orders');
    expect(paths).toContain('/neye/fitting-orders');
    expect(paths).not.toContain('/neye/system');
    expect(paths).not.toContain('/neye/product-items');
  });
});
