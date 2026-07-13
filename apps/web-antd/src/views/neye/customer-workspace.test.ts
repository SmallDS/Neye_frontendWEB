import { describe, expect, it } from 'vitest';

import type { FittingOrder, OptometryOrder } from '#/types/neye';

import {
  resolveWorkspaceSelection,
  sortOptometryOrders,
} from './customer-workspace';

const orders = [
  { id: 'older', optometryDate: '2025-01-01', orderNo: 'O-1' },
  { id: 'latest', optometryDate: '2026-07-13', orderNo: 'O-2' },
] as OptometryOrder[];

const fittings = [
  {
    id: 'fitting-1',
    optometryOrderId: 'older',
  },
] as FittingOrder[];

describe('customer workspace selection', () => {
  it('sorts optometry orders by date descending', () => {
    expect(sortOptometryOrders(orders).map((item) => item.id)).toEqual([
      'latest',
      'older',
    ]);
  });

  it('opens the latest order by default', () => {
    const sorted = sortOptometryOrders(orders);
    expect(resolveWorkspaceSelection(sorted, fittings).optometryId).toBe(
      'latest',
    );
  });

  it('uses the optometry order linked to an opened fitting order', () => {
    const sorted = sortOptometryOrders(orders);
    const result = resolveWorkspaceSelection(
      sorted,
      fittings,
      'latest',
      'fitting-1',
    );
    expect(result.optometryId).toBe('older');
    expect(result.fitting?.id).toBe('fitting-1');
  });
});