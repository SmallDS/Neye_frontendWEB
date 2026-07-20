import type {
  FittingOrder,
  PickupNotificationStatus,
  WechatPickupNotificationSettings,
} from '#/types/neye';

const STATUS_META: Record<
  PickupNotificationStatus,
  { color: string; label: string }
> = {
  failed: { color: 'red', label: '发送失败' },
  pending: { color: 'blue', label: '待发送' },
  retrying: { color: 'orange', label: '重试中' },
  sent: { color: 'green', label: '已发送' },
  unsubscribed: { color: 'default', label: '未订阅' },
};

export function pickupStatusMeta(status?: PickupNotificationStatus) {
  return STATUS_META[status ?? 'unsubscribed'];
}

export function pickupActions(order: FittingOrder) {
  const status = order.pickupNotification?.status ?? 'unsubscribed';
  return {
    canGenerateQr: !order.pickupNotification?.receiverLocked,
    canMarkReady: !order.readyForPickupAt,
    canRetry: status === 'failed',
  };
}

export function validatePickupSettings(
  settings: Pick<
    WechatPickupNotificationSettings,
    'enabled' | 'keywordMapping' | 'pickupTip' | 'templateId'
  >,
) {
  if (!settings.enabled) return [];
  const errors: string[] = [];
  if (!settings.templateId.trim()) errors.push('请输入模板 ID');
  if (!settings.pickupTip.trim() || settings.pickupTip.trim().length > 200) {
    errors.push('取镜提示须为 1-200 个字符');
  }
  const keywords = settings.keywordMapping.map((item) => item.keyword.trim());
  if (
    keywords.some(
      (keyword) =>
        !/^(?:thing|character_string|time|date|number)\d+$/.test(keyword),
    )
  ) {
    errors.push('关键词格式须与微信模板字段一致');
  }
  if (new Set(keywords).size !== keywords.length) errors.push('关键词不能重复');
  return errors;
}
