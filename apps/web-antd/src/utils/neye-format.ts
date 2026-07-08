import type { Gender, ProductItemCategory, TenantStatus } from '#/types/neye';

export function formatDate(value?: null | string) {
  return value ? value.slice(0, 10) : '-';
}

export function money(value?: null | number | string) {
  return `¥${Number(value ?? 0).toFixed(2)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function genderText(value?: Gender) {
  const map: Record<Gender, string> = { female: '女', male: '男', unknown: '未知' };
  return map[value ?? 'unknown'];
}

export function productCategoryText(value: ProductItemCategory) {
  const map: Record<ProductItemCategory, string> = { frame: '镜架', lens: '镜片', other: '其他' };
  return map[value];
}

export function tenantStatusText(value: TenantStatus) {
  const map: Record<TenantStatus, string> = { active: '启用', disabled: '停用' };
  return map[value];
}