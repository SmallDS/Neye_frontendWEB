import type {
  EventLogCategory,
  EventLogLevel,
  EventLogResult,
} from '#/types/neye';

export function eventLogLevelInfo(level: EventLogLevel) {
  const map = {
    ERROR: { color: 'red', text: '错误' },
    INFO: { color: 'blue', text: '信息' },
    WARN: { color: 'orange', text: '警告' },
  } as const;
  return map[level];
}

export function eventLogCategoryText(category: EventLogCategory) {
  const map: Record<EventLogCategory, string> = {
    AUDIT: '审计',
    SECURITY: '安全',
    SYSTEM: '系统',
  };
  return map[category];
}

export function eventLogResultInfo(result: EventLogResult) {
  const map = {
    DENIED: { color: 'orange', text: '已拒绝' },
    FAILED: { color: 'red', text: '失败' },
    SUCCESS: { color: 'green', text: '成功' },
  } as const;
  return map[result];
}

export function validateEventLogClear(
  confirmation: string,
  expectedConfirmation: string,
  reason: string,
) {
  if (reason.trim().length < 5) return '清空原因至少需要 5 个字符';
  if (confirmation !== expectedConfirmation) {
    return `请输入“${expectedConfirmation}”完成确认`;
  }
  return '';
}

export function formatEventLogMetadata(metadata: unknown) {
  if (metadata === undefined || metadata === null) return '-';
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}
