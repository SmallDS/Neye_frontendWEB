import { describe, expect, it, vi } from 'vitest';

import { neyeLabel } from './labels';

describe('neyeLabel', () => {
  it('将协议枚举显示为中文', () => {
    expect(neyeLabel('admin')).toBe('管理员');
    expect(neyeLabel('partially_paid')).toBe('部分收款');
    expect(neyeLabel('transfer_out')).toBe('调拨出库');
  });

  it('未知枚举不直接暴露给用户', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(neyeLabel('unexpected_value')).toBe('未知状态');
  });
});
