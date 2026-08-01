import { describe, expect, it } from 'vitest';

import {
  eventLogActionText,
  eventLogCategoryText,
  eventLogLevelInfo,
  eventLogModuleOptions,
  eventLogModuleText,
  eventLogReasonText,
  eventLogResourceTypeText,
  eventLogResultInfo,
  eventLogSystemMessageText,
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

  it.each([
    ['auth', '登录认证'],
    ['customers', '客户管理'],
    ['event_logs', '日志中心'],
    ['fitting_orders', '配镜单'],
    ['http', 'HTTP 服务'],
    ['import_tasks', '导入任务'],
    ['optometry_orders', '验光单'],
    ['pickup_notifications', '取镜通知'],
    ['product_items', '商品目录'],
    ['security', '安全防护'],
    ['system_settings', '系统设置'],
    ['tenants', '店铺管理'],
    ['users', '账号管理'],
  ])('maps module %s to %s', (value, expected) => {
    expect(eventLogModuleText(value)).toBe(expected);
  });

  it('provides Chinese module filter labels with backend values', () => {
    expect(eventLogModuleOptions).toContainEqual({
      label: '日志中心',
      value: 'event_logs',
    });
    expect(eventLogModuleOptions).toContainEqual({
      label: '安全防护',
      value: 'security',
    });
  });

  it.each([
    ['ADMIN_PASSWORD_RESET', '重置管理员密码'],
    ['BATCH_DELETED', '批量删除'],
    ['BATCH_STATUS_CHANGED', '批量变更状态'],
    ['CANCELED', '导入任务已取消'],
    ['CANCEL_REQUESTED', '请求取消导入任务'],
    ['CLEARED', '清空日志'],
    ['COMPLETED', '导入任务完成'],
    ['CREATED', '新建'],
    ['DELETED', '删除'],
    ['FAILED', '导入任务失败'],
    ['HTTP_401', '未认证访问'],
    ['HTTP_403', '无权限访问'],
    ['HTTP_429', '请求过于频繁'],
    ['LEASE_LOST', '导入任务工作租约丢失'],
    ['LOGIN', '账号登录'],
    ['MEMBER_CREATED', '添加店铺成员'],
    ['MEMBER_PASSWORD_RESET', '重置店铺成员密码'],
    ['MEMBER_REMOVED', '移除店铺成员'],
    ['MEMBER_UPDATED', '更新店铺成员'],
    ['OPTOMETRY_STYLE_UPDATED', '更新验光样式'],
    ['PASSWORD_CHANGED', '修改密码'],
    ['PASSWORD_RESET', '重置密码'],
    ['PICKUP_NOTIFICATION_FAILED', '取镜通知发送失败'],
    ['PICKUP_NOTIFICATION_MANUAL_RETRY', '手动重试取镜通知'],
    ['PICKUP_NOTIFICATION_RETRY_SCHEDULED', '已安排重试取镜通知'],
    ['PICKUP_NOTIFICATION_SENT', '取镜通知发送成功'],
    ['PICKUP_READY_MARKED', '标记可取镜'],
    ['PICKUP_SUBSCRIBED', '订阅取镜通知'],
    ['PROFILE_UPDATED', '更新个人资料'],
    ['RETENTION_CLEANUP', '自动清理过期日志'],
    ['RETENTION_UPDATED', '更新日志保留期限'],
    ['ROLLED_BACK', '回滚导入任务'],
    ['TENANTS_ASSIGNED', '分配店铺'],
    ['UNHANDLED_EXCEPTION', '未处理的系统异常'],
    ['UPDATED', '更新'],
    ['WECHAT_AUTH_UPDATED', '更新微信认证设置'],
    ['WECHAT_BOUND', '绑定微信'],
    ['WECHAT_LOGIN', '微信登录'],
    ['WECHAT_PICKUP_NOTIFICATION_UPDATED', '更新微信取镜通知设置'],
    ['WECHAT_UNBOUND', '解绑微信'],
  ])('maps action %s to %s', (value, expected) => {
    expect(eventLogActionText(value)).toBe(expected);
  });

  it.each([
    ['customer', '客户'],
    ['fitting_order', '配镜单'],
    ['import_task', '导入任务'],
    ['optometry_order', '验光单'],
    ['product_item', '商品'],
    ['system_setting', '系统设置'],
    ['tenant', '店铺'],
    ['tenant_optometry_style', '店铺验光样式'],
    ['user', '账号'],
  ])('maps resource type %s to %s', (value, expected) => {
    expect(eventLogResourceTypeText(value)).toBe(expected);
  });

  it('translates only known generated reason and error messages', () => {
    expect(eventLogSystemMessageText('Retention changed to 180 days')).toBe(
      '日志保留期限已调整为 180 天',
    );
    expect(
      eventLogSystemMessageText('Automatic retention cleanup (90 days)'),
    ).toBe('自动清理超过 90 天的日志');
    expect(eventLogSystemMessageText('Invalid username or password')).toBe(
      '账号或密码错误',
    );
    expect(eventLogSystemMessageText('Missing bearer token')).toBe(
      '缺少登录凭证',
    );
    expect(
      eventLogSystemMessageText(
        'Too many authentication attempts. Please try again later.',
      ),
    ).toBe('认证尝试次数过多，请稍后重试');
    expect(eventLogSystemMessageText('Tenant context is required')).toBe(
      '缺少店铺上下文',
    );
    expect(eventLogSystemMessageText('Fitting order not found')).toBe(
      '配镜单不存在',
    );
    expect(eventLogSystemMessageText('Unhandled internal server error')).toBe(
      '未处理的内部服务器错误',
    );
    expect(eventLogSystemMessageText('门店人工复核后重试')).toBe(
      '门店人工复核后重试',
    );
  });

  it('translates only generated retention reasons', () => {
    expect(
      eventLogReasonText('RETENTION_UPDATED', 'Retention changed to 180 days'),
    ).toBe('日志保留期限已调整为 180 天');
    expect(
      eventLogReasonText(
        'RETENTION_CLEANUP',
        'Automatic retention cleanup (90 days)',
      ),
    ).toBe('自动清理超过 90 天的日志');
    expect(
      eventLogReasonText('CLEARED', 'Invalid username or password'),
    ).toBe('Invalid username or password');
    expect(
      eventLogReasonText(
        'PICKUP_NOTIFICATION_MANUAL_RETRY',
        'Retention changed to 180 days',
      ),
    ).toBe('Retention changed to 180 days');
    expect(eventLogReasonText('CLEARED', null)).toBe('-');
  });

  it('falls back to unknown backend values without changing them', () => {
    expect(eventLogModuleText('future_module')).toBe('future_module');
    expect(eventLogActionText('FUTURE_ACTION')).toBe('FUTURE_ACTION');
    expect(eventLogResourceTypeText('future_resource')).toBe(
      'future_resource',
    );
    expect(eventLogSystemMessageText('Unknown generated message')).toBe(
      'Unknown generated message',
    );
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

  it('formats nested metadata recursively while preserving unknown data', () => {
    const formatted = formatEventLogMetadata({
      changedFields: ['status', 'futureField'],
      delivery: {
        receiverSubscribed: true,
        taskCreated: false,
        taskId: 'task-001',
      },
      retries: [{ cycle: 2, nextRetryAt: '2026-08-01T10:00:00.000Z' }],
      scope: 'beforeDate',
      untouched: 'raw-value',
    });

    expect(JSON.parse(formatted)).toEqual({
      变更字段: ['状态', 'futureField'],
      delivery: {
        接收人已订阅: '是',
        已创建通知任务: '否',
        '任务 ID': 'task-001',
      },
      retries: [{ 下次重试时间: '2026-08-01T10:00:00.000Z', 重试轮次: 2 }],
      清理范围: '指定日期前',
      untouched: 'raw-value',
    });
    expect(formatEventLogMetadata(null)).toBe('-');
  });
});
