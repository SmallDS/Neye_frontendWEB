import type { WechatPickupNotificationSettings } from '#/types/neye';

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
        !/^(?:thing|character_string|time|date|number|name|phone_number)\d+$/.test(
          keyword,
        ),
    )
  ) {
    errors.push('关键词格式须与微信模板字段一致');
  }
  const storePhone = settings.keywordMapping.find(
    (item) => item.source === 'store_phone',
  );
  if (storePhone && !/^phone_number\d+$/.test(storePhone.keyword.trim())) {
    errors.push('门店电话必须映射到 phone_numberXX 关键词');
  }
  if (new Set(keywords).size !== keywords.length) errors.push('关键词不能重复');
  return errors;
}
