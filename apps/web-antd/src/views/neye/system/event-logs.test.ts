import { describe, expect, it } from 'vitest';

import {
  eventLogCategoryText,
  eventLogLevelInfo,
  eventLogResultInfo,
  formatEventLogMetadata,
  validateEventLogClear,
} from './event-logs';

describe('event log helpers', () => {
  it('maps backend enum values to admin labels', () => {
    expect(eventLogLevelInfo('WARN')).toEqual({
      color: 'orange',
      text: '警告',
    });
    expect(eventLogCategoryText('SECURITY')).toBe('安全');
    expect(eventLogResultInfo('DENIED')).toEqual({
      color: 'orange',
      text: '已拒绝',
    });
  });

  it('requires a reason and the exact server confirmation text', () => {
    expect(validateEventLogClear('清空日志', '清空全部日志', '')).toBe(
      '清空原因至少需要 5 个字符',
    );
    expect(
      validateEventLogClear('清空日志', '清空全部日志', '例行日志清理'),
    ).toContain('清空全部日志');
    expect(
      validateEventLogClear('清空全部日志', '清空全部日志', '例行日志清理'),
    ).toBe('');
  });

  it('formats structured metadata for detail display', () => {
    expect(formatEventLogMetadata({ changedFields: ['status'] })).toContain(
      'changedFields',
    );
    expect(formatEventLogMetadata(null)).toBe('-');
  });
});
