import { describe, expect, it } from 'vitest';

import {
  customerDetailPath,
  nextCustomerSearchIndex,
} from './customer-search';

describe('customer search navigation', () => {
  it('builds a customer detail path', () => {
    expect(customerDetailPath('customer-id')).toBe(
      '/neye/customers/customer-id',
    );
  });

  it('moves through results and wraps at both ends', () => {
    expect(nextCustomerSearchIndex(0, 3, 1)).toBe(1);
    expect(nextCustomerSearchIndex(2, 3, 1)).toBe(0);
    expect(nextCustomerSearchIndex(0, 3, -1)).toBe(2);
    expect(nextCustomerSearchIndex(-1, 3, 1)).toBe(0);
    expect(nextCustomerSearchIndex(-1, 0, 1)).toBe(-1);
  });
});