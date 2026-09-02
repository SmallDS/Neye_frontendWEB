import type {
  CommercePermission,
  TenantPermissionGroup,
  TenantSummary,
} from './types';

export const tenantPermissionGroups: TenantPermissionGroup[] = [
  {
    key: 'customers',
    label: '客户管理',
    permissions: ['customer.read', 'customer.write'],
  },
  {
    key: 'optometry',
    label: '验光管理',
    permissions: ['optometry.read', 'optometry.write'],
  },
  {
    key: 'fitting',
    label: '配镜管理',
    permissions: ['fitting.read', 'fitting.write', 'fitting.notify'],
  },
  {
    key: 'checkout',
    label: '收银管理',
    permissions: [
      'checkout.read',
      'checkout.create',
      'checkout.collect',
      'checkout.refund',
      'checkout.override_price',
    ],
  },
  {
    key: 'inventory',
    label: '库存管理',
    permissions: [
      'inventory.read',
      'inventory.receive',
      'inventory.adjust',
      'inventory.count',
      'inventory.transfer',
    ],
  },
  {
    key: 'store',
    label: '门店经营',
    permissions: ['commerce.settings', 'commerce.reports'],
  },
];

export function hasTenantPermission(
  tenant: null | TenantSummary | undefined,
  permission: CommercePermission,
) {
  return tenant?.permissions.includes(permission) ?? false;
}

export function hasAnyTenantPermission(
  tenant: null | TenantSummary | undefined,
  permissions: CommercePermission[],
) {
  return permissions.some((permission) =>
    hasTenantPermission(tenant, permission),
  );
}
