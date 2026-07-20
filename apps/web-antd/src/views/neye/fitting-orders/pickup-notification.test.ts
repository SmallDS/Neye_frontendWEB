import { describe, expect, it } from 'vitest';

import {
  pickupActions,
  pickupStatusMeta,
  validatePickupSettings,
} from './pickup-notification';

const baseOrder = {
  id: 'fitting-1',
  tenantId: 'tenant-1',
  orderNo: 'F001',
  customerId: 'customer-1',
  optometryOrderId: 'optometry-1',
  framePrice: '0',
  lensPrice: '0',
  otherPrice: '0',
  totalAmount: '0',
  createdAt: '2026-07-20T00:00:00.000Z',
};

const validSettings = {
  enabled: true,
  templateId: 'template-1',
  pickupTip: '请到店取镜',
  keywordMapping: [
    { keyword: 'character_string1', source: 'order_no' as const },
    { keyword: 'thing2', source: 'store_name' as const },
    { keyword: 'time3', source: 'ready_for_pickup_at' as const },
    { keyword: 'thing4', source: 'pickup_tip' as const },
  ],
};

describe('pickup notification view state', () => {
  it('maps every status to stable display metadata', () => {
    expect(pickupStatusMeta('failed')).toEqual({
      color: 'red',
      label: '发送失败',
    });
    expect(pickupStatusMeta('sent')).toEqual({
      color: 'green',
      label: '已发送',
    });
    expect(pickupStatusMeta()).toEqual({ color: 'default', label: '未订阅' });
  });

  it('enables only actions valid for the current state', () => {
    expect(
      pickupActions({
        ...baseOrder,
        pickupNotification: {
          status: 'failed',
          receiverSubscribed: true,
          receiverLocked: true,
          attempts: 5,
          maxAttemptsPerCycle: 5,
        },
      }),
    ).toEqual({
      canGenerateQr: false,
      canMarkReady: true,
      canRetry: true,
    });
    expect(
      pickupActions({
        ...baseOrder,
        readyForPickupAt: '2026-07-20T00:00:00.000Z',
        pickupNotification: {
          status: 'sent',
          receiverSubscribed: true,
          receiverLocked: true,
          attempts: 1,
          maxAttemptsPerCycle: 5,
        },
      }),
    ).toEqual({
      canGenerateQr: false,
      canMarkReady: false,
      canRetry: false,
    });
  });

  it('validates enabled configuration while allowing disabled drafts', () => {
    expect(validatePickupSettings(validSettings)).toEqual([]);
    expect(
      validatePickupSettings({
        ...validSettings,
        templateId: '',
        keywordMapping: validSettings.keywordMapping.map((item) => ({
          ...item,
          keyword: 'bad',
        })),
      }),
    ).toContain('请输入模板 ID');
    expect(
      validatePickupSettings({
        ...validSettings,
        enabled: false,
        templateId: '',
      }),
    ).toEqual([]);
  });
});
