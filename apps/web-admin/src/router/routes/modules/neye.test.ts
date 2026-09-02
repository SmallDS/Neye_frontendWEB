import type { RouteRecordRaw } from 'vue-router';

import { describe, expect, it } from 'vitest';

import routes from './neye';

function flatten(items: RouteRecordRaw[]): RouteRecordRaw[] {
  return items.flatMap((route) => [
    route,
    ...flatten((route.children ?? []) as RouteRecordRaw[]),
  ]);
}

describe('administrator routes', () => {
  it('contains platform routes and no merchant business routes', () => {
    const paths = flatten(routes).map((route) => route.path);
    expect(paths).toContain('/neye/system');
    expect(paths).toContain('/neye/product-items');
    expect(paths).not.toContain('/neye/customers');
    expect(paths).not.toContain('/neye/optometry-orders');
    expect(paths).not.toContain('/neye/fitting-orders');
  });
});
