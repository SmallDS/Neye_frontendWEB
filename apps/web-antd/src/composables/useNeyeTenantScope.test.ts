import { describe, expect, it } from 'vitest';

import {
  resolveScopedTenantId,
  shouldShowTenantSelector,
} from './useNeyeTenantScope';

describe('useNeyeTenantScope helpers', () => {
  it('forces a selector for multi-tenant staff even in single tenant mode', () => {
    expect(
      shouldShowTenantSelector({
        activeTenantCount: 2,
        forceTenantSelector: true,
        isAdmin: false,
        tenantMode: 'single',
      }),
    ).toBe(true);
  });

  it('preserves preference-controlled selector behavior by default', () => {
    expect(
      shouldShowTenantSelector({
        activeTenantCount: 2,
        forceTenantSelector: false,
        isAdmin: false,
        tenantMode: 'single',
      }),
    ).toBe(false);
    expect(
      shouldShowTenantSelector({
        activeTenantCount: 2,
        forceTenantSelector: false,
        isAdmin: false,
        tenantMode: 'multi',
      }),
    ).toBe(true);
  });

  it('uses the explicit selection as the scope in forced mode', () => {
    expect(
      resolveScopedTenantId({
        currentTenantId: 'tenant-a',
        forceTenantSelector: true,
        selectedTenantId: 'tenant-b',
        selectorVisible: true,
      }),
    ).toBe('tenant-b');
    expect(
      resolveScopedTenantId({
        currentTenantId: null,
        forceTenantSelector: true,
        selectedTenantId: '',
        selectorVisible: true,
      }),
    ).toBe('');
  });

  it('keeps the current tenant scope for existing single-mode pages', () => {
    expect(
      resolveScopedTenantId({
        currentTenantId: 'tenant-a',
        forceTenantSelector: false,
        selectedTenantId: 'tenant-b',
        selectorVisible: false,
      }),
    ).toBe('tenant-a');
  });
});