import type { UserBatchStatusItem, UserStatus } from '#/types/neye';

export interface ClientImportCapabilities {
  maxFileBytes: number;
  maxRows: number;
  maxColumns: number;
  maxSheets: number;
  batchSize: number;
  workerConcurrency: number;
}

export const DEFAULT_IMPORT_CAPABILITIES: ClientImportCapabilities = {
  batchSize: 750,
  maxColumns: 80,
  maxFileBytes: 50 * 1024 * 1024,
  maxRows: 50_000,
  maxSheets: 10,
  workerConcurrency: 1,
};

export function formatImportFileSize(bytes: number) {
  return `${Math.floor(bytes / 1024 / 1024)} MB`;
}

export function validateDangerConfirmation(
  actualName: string,
  expectedName: string,
) {
  if (actualName.trim() !== expectedName)
    return `请输入“${expectedName}”完成确认`;
  return '';
}

export function userStatusConfirmationText(status: UserStatus) {
  return status === 'active' ? '确认启用' : '确认停用';
}

export function summarizeBatchStatus(items: UserBatchStatusItem[]) {
  const summary = { failed: 0, succeeded: 0 };
  for (const item of items) {
    if (item.success) summary.succeeded += 1;
    else summary.failed += 1;
  }
  return summary;
}

export type ImportDangerKind = 'cancel' | 'delete' | 'rollback';

export function importDangerDescription(kind?: ImportDangerKind) {
  if (kind === 'cancel') {
    return '取消会清理本任务所有尚未发布的数据，不会产生部分可见数据；原子发布阶段不可取消。';
  }
  if (kind === 'rollback') {
    return '会删除本次导入创建的客户、验光单及关联配镜单；商品字典不会回滚。';
  }
  return '只删除任务记录，不删除已导入业务数据；如需删除业务数据请先回滚。';
}
export function isSupportedImportFile(
  file: Pick<File, 'name' | 'size'>,
  capabilities: ClientImportCapabilities = DEFAULT_IMPORT_CAPABILITIES,
) {
  return /\.xlsx?$/i.test(file.name) && file.size <= capabilities.maxFileBytes;
}
export function createIdempotencyKey(
  cryptoApi: Pick<Crypto, 'getRandomValues' | 'randomUUID'> = globalThis.crypto,
) {
  if (typeof cryptoApi?.randomUUID === 'function')
    return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new TypeError('当前浏览器不支持安全随机数，请升级浏览器后重试');
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  // oxlint-disable-next-line unicorn/number-literal-case -- oxfmt normalizes hexadecimal digits to lowercase.
  bytes[6] = ((bytes.at(6) ?? 0) & 0x0f) | 0x40;
  // oxlint-disable-next-line unicorn/number-literal-case -- oxfmt normalizes hexadecimal digits to lowercase.
  bytes[8] = ((bytes.at(8) ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
