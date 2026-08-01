import type {
  EventLogCategory,
  EventLogLevel,
  EventLogResult,
} from '#/types/neye';

const EVENT_LOG_MODULE_TEXT: Record<string, string> = {
  auth: '登录认证',
  customers: '客户管理',
  event_logs: '日志中心',
  fitting_orders: '配镜单',
  http: 'HTTP 服务',
  import_tasks: '导入任务',
  optometry_orders: '验光单',
  pickup_notifications: '取镜通知',
  product_items: '商品目录',
  security: '安全防护',
  system_settings: '系统设置',
  tenants: '店铺管理',
  users: '账号管理',
};

export const eventLogModuleOptions = Object.entries(EVENT_LOG_MODULE_TEXT).map(
  ([value, label]) => ({ label, value }),
);

const EVENT_LOG_ACTION_TEXT: Record<string, string> = {
  ADMIN_PASSWORD_RESET: '重置管理员密码',
  BATCH_DELETED: '批量删除',
  BATCH_STATUS_CHANGED: '批量变更状态',
  CANCELED: '导入任务已取消',
  CANCEL_REQUESTED: '请求取消导入任务',
  CLEARED: '清空日志',
  COMPLETED: '导入任务完成',
  CREATED: '新建',
  DELETED: '删除',
  FAILED: '导入任务失败',
  HTTP_401: '未认证访问',
  HTTP_403: '无权限访问',
  HTTP_429: '请求过于频繁',
  LEASE_LOST: '导入任务工作租约丢失',
  LOGIN: '账号登录',
  MEMBER_CREATED: '添加店铺成员',
  MEMBER_PASSWORD_RESET: '重置店铺成员密码',
  MEMBER_REMOVED: '移除店铺成员',
  MEMBER_UPDATED: '更新店铺成员',
  OPTOMETRY_STYLE_UPDATED: '更新验光样式',
  PASSWORD_CHANGED: '修改密码',
  PASSWORD_RESET: '重置密码',
  PICKUP_NOTIFICATION_FAILED: '取镜通知发送失败',
  PICKUP_NOTIFICATION_MANUAL_RETRY: '手动重试取镜通知',
  PICKUP_NOTIFICATION_RETRY_SCHEDULED: '已安排重试取镜通知',
  PICKUP_NOTIFICATION_SENT: '取镜通知发送成功',
  PICKUP_READY_MARKED: '标记可取镜',
  PICKUP_SUBSCRIBED: '订阅取镜通知',
  PROFILE_UPDATED: '更新个人资料',
  RETENTION_CLEANUP: '自动清理过期日志',
  RETENTION_UPDATED: '更新日志保留期限',
  ROLLED_BACK: '回滚导入任务',
  TENANTS_ASSIGNED: '分配店铺',
  UNHANDLED_EXCEPTION: '未处理的系统异常',
  UPDATED: '更新',
  WECHAT_AUTH_UPDATED: '更新微信认证设置',
  WECHAT_BOUND: '绑定微信',
  WECHAT_LOGIN: '微信登录',
  WECHAT_PICKUP_NOTIFICATION_UPDATED: '更新微信取镜通知设置',
  WECHAT_UNBOUND: '解绑微信',
};

const EVENT_LOG_RESOURCE_TYPE_TEXT: Record<string, string> = {
  customer: '客户',
  fitting_order: '配镜单',
  import_task: '导入任务',
  optometry_order: '验光单',
  product_item: '商品',
  system_setting: '系统设置',
  tenant: '店铺',
  tenant_optometry_style: '店铺验光样式',
  user: '账号',
};

const SYSTEM_MESSAGE_TEXT: Record<string, string> = {
  'Account not found': '账号不存在',
  'Bad Request Exception': '请求参数错误',
  'Cannot access an unassigned tenant': '无权访问未分配的店铺',
  'Cannot access another tenant': '无权访问其他店铺',
  'Conflict Exception': '请求状态冲突',
  'Current password is incorrect': '当前密码错误',
  'Customer has optometry orders': '客户存在验光单，无法执行该操作',
  'Customer not found': '客户不存在',
  'Event log not found': '日志不存在',
  'Fitting order not found': '配镜单不存在',
  'Forbidden resource': '无权访问该资源',
  'Import processing failed': '导入处理失败',
  'Import task not found': '导入任务不存在',
  'Import worker lease was lost': '导入任务工作租约已丢失',
  'Insufficient role': '当前账号权限不足',
  'Internal server error': '内部服务器错误',
  'Invalid bearer token': '登录凭证无效或已过期',
  'Invalid username or password': '账号或密码错误',
  'Missing bearer token': '缺少登录凭证',
  'New password must be different from the current password':
    '新密码不能与当前密码相同',
  'Not Found': '请求的资源不存在',
  'Optometry order has fitting orders': '验光单存在配镜单，无法执行该操作',
  'Optometry order not found': '验光单不存在',
  'Product item not found': '商品不存在',
  'Service Unavailable': '服务暂时不可用',
  'Some accounts are not found': '部分账号不存在',
  'Some assigned tenants do not exist': '部分已分配店铺不存在',
  'Some customers are not found or not accessible': '部分客户不存在或无权访问',
  'Some fitting orders are not found or not accessible':
    '部分配镜单不存在或无权访问',
  'Some optometry orders are not found or not accessible':
    '部分验光单不存在或无权访问',
  'Some product items are not found': '部分商品不存在',
  'Some tenants are not found': '部分店铺不存在',
  'Tenant account assignment not found': '店铺账号分配关系不存在',
  'Tenant account not found': '店铺账号不存在',
  'Tenant context is required': '缺少店铺上下文',
  'Tenant not found': '店铺不存在',
  'This account is not assigned to an active tenant': '当前账号未分配有效店铺',
  'Too many authentication attempts. Please try again later.':
    '认证尝试次数过多，请稍后重试',
  'Unauthorized': '未登录或登录已过期',
  'Unhandled internal server error': '未处理的内部服务器错误',
  'Wechat login session not found': '微信登录会话不存在',
};

const METADATA_KEY_TEXT: Record<string, string> = {
  actualCount: '实际数量',
  attemptNo: '尝试序号',
  beforeDate: '截止日期',
  changedFields: '变更字段',
  cutoff: '截止时间',
  cycle: '重试轮次',
  deletedCount: '删除数量',
  errorCode: '错误代码',
  expectedCount: '预计数量',
  nextRetryAt: '下次重试时间',
  receiverLocked: '接收人已锁定',
  receiverSubscribed: '接收人已订阅',
  retentionDays: '保留天数',
  scope: '清理范围',
  taskCreated: '已创建通知任务',
  taskId: '任务 ID',
  tokenRefreshed: '访问令牌已刷新',
};

const CHANGED_FIELD_TEXT: Record<string, string> = {
  displayName: '显示名称',
  envVersion: '微信环境版本',
  role: '角色',
  status: '状态',
  tenantIds: '店铺列表',
};

function mappedText(
  value: null | string | undefined,
  map: Record<string, string>,
) {
  if (!value) return '-';
  return map[value] || value;
}

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

export function eventLogModuleText(module: null | string | undefined) {
  return mappedText(module, EVENT_LOG_MODULE_TEXT);
}

export function eventLogActionText(action: null | string | undefined) {
  return mappedText(action, EVENT_LOG_ACTION_TEXT);
}

export function eventLogResourceTypeText(
  resourceType: null | string | undefined,
) {
  return mappedText(resourceType, EVENT_LOG_RESOURCE_TYPE_TEXT);
}

export function eventLogSystemMessageText(
  message: null | string | undefined,
) {
  if (!message) return '-';
  const exact = SYSTEM_MESSAGE_TEXT[message];
  if (exact) return exact;

  const retentionChanged = /^Retention changed to (\d+) days$/.exec(message);
  if (retentionChanged) {
    return `日志保留期限已调整为 ${retentionChanged[1]} 天`;
  }

  const automaticCleanup =
    /^Automatic retention cleanup \((\d+) days\)$/.exec(message);
  if (automaticCleanup) {
    return `自动清理超过 ${automaticCleanup[1]} 天的日志`;
  }

  const invalidProduct = /^Invalid (frame|lens|other) product item$/.exec(
    message,
  );
  if (invalidProduct) {
    const category = { frame: '镜架', lens: '镜片', other: '其他' }[
      invalidProduct[1] as 'frame' | 'lens' | 'other'
    ];
    return `无效的${category}商品`;
  }

  return message;
}

export function eventLogReasonText(
  action: null | string | undefined,
  reason: null | string | undefined,
) {
  if (!reason) return '-';
  if (action === 'RETENTION_UPDATED' || action === 'RETENTION_CLEANUP') {
    return eventLogSystemMessageText(reason);
  }
  return reason;
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

function translateMetadata(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (parentKey === 'changedFields' && typeof item === 'string') {
        return CHANGED_FIELD_TEXT[item] || item;
      }
      return translateMetadata(item);
    });
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        METADATA_KEY_TEXT[key] || key,
        translateMetadata(item, key),
      ]),
    );
  }
  if (parentKey === 'scope') {
    if (value === 'all') return '全部日志';
    if (value === 'beforeDate') return '指定日期前';
  }
  if (
    typeof value === 'boolean' &&
    [
      'receiverLocked',
      'receiverSubscribed',
      'taskCreated',
      'tokenRefreshed',
    ].includes(parentKey || '')
  ) {
    return value ? '是' : '否';
  }
  return value;
}

export function formatEventLogMetadata(metadata: unknown) {
  if (metadata === undefined || metadata === null) return '-';
  try {
    return JSON.stringify(translateMetadata(metadata), null, 2);
  } catch {
    return String(metadata);
  }
}
