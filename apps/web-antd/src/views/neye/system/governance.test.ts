import { describe, expect, it } from 'vitest';

import {
  createIdempotencyKey,
  DEFAULT_IMPORT_CAPABILITIES,
  formatImportFileSize,
  importDangerDescription,
  isSupportedImportFile,
  summarizeBatchStatus,
  userStatusConfirmationText,
  validateDangerConfirmation,
} from './governance';

describe('system governance helpers', () => {
  it('requires an exact object-name confirmation', () => {
    expect(
      validateDangerConfirmation('\u95e8\u5e97A', '\u95e8\u5e97 A'),
    ).toContain('\u95e8\u5e97 A');
    expect(
      validateDangerConfirmation('\u95e8\u5e97 A', '\u95e8\u5e97 A'),
    ).toBe('');
  });
  it('uses an explicit second-confirmation phrase for account status', () => {
    expect(userStatusConfirmationText('active')).toBe('确认启用');
    expect(userStatusConfirmationText('disabled')).toBe('确认停用');
  });

  it('summarizes per-account batch results', () => {
    expect(
      summarizeBatchStatus([
        { success: true, userId: '1' },
        { message: '不能停用当前账号', success: false, userId: '2' },
      ]),
    ).toEqual({ failed: 1, succeeded: 1 });
  });

  it('uses a secure UUID fallback without Math.random', () => {
    const cryptoApi = {
      getRandomValues(array: Uint8Array) {
        array.forEach((_, index) => {
          array[index] = index;
        });
        return array;
      },
      randomUUID: undefined,
    } as unknown as Pick<Crypto, 'getRandomValues' | 'randomUUID'>;

    expect(createIdempotencyKey(cryptoApi)).toBe(
      '00010203-0405-4607-8809-0a0b0c0d0e0f',
    );
  });

  it('validates spreadsheet extension and size', () => {
    expect(isSupportedImportFile({ name: 'customers.xlsx', size: 1024 })).toBe(
      true,
    );
    expect(isSupportedImportFile({ name: 'customers.csv', size: 1024 })).toBe(
      false,
    );
    expect(
      isSupportedImportFile({ name: 'customers.xls', size: 51 * 1024 * 1024 }),
    ).toBe(false);
    expect(formatImportFileSize(DEFAULT_IMPORT_CAPABILITIES.maxFileBytes)).toBe(
      '50 MB',
    );
    expect(
      isSupportedImportFile(
        { name: 'customers.xlsx', size: 2048 },
        { ...DEFAULT_IMPORT_CAPABILITIES, maxFileBytes: 1024 },
      ),
    ).toBe(false);
  });
  it('describes cancellation as all-or-nothing and blocks publishing cancellation', () => {
    const description = importDangerDescription('cancel');
    expect(description).toContain('清理本任务所有尚未发布的数据');
    expect(description).toContain('不会产生部分可见数据');
    expect(description).toContain('原子发布阶段不可取消');
    expect(description).not.toContain('已成功导入的数据会保留');
  });
});
