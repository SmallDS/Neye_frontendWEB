import { describe, expect, it } from 'vitest';

import {
  customerDetailLocation,
  customerListLocation,
  customerListPath,
  parseCustomerListState,
  resolveCustomerListReturnTo,
} from './customer-list-navigation';

describe('customer list navigation', () => {
  it('restores keyword and a valid page from route query', () => {
    expect(
      parseCustomerListState({ keyword: ['张三'], page: '3' }),
    ).toEqual({ keyword: '张三', page: 3 });
    expect(parseCustomerListState({ page: '2.5' }).page).toBe(1);
    expect(parseCustomerListState({ page: 'invalid' }).page).toBe(1);
  });

  it('writes the active filters into list and detail locations', () => {
    const state = { keyword: '张 三', page: 2 };
    expect(customerListLocation(state)).toEqual({
      path: '/neye/customers',
      query: { keyword: '张 三', page: '2' },
    });
    expect(customerListPath(state)).toBe(
      '/neye/customers?keyword=%E5%BC%A0+%E4%B8%89&page=2',
    );
    expect(customerDetailLocation('customer-1', state)).toEqual({
      path: '/neye/customers/customer-1',
      query: {
        returnTo: '/neye/customers?keyword=%E5%BC%A0+%E4%B8%89&page=2',
      },
    });
  });

  it('accepts only customer list return paths', () => {
    expect(
      resolveCustomerListReturnTo('/neye/customers?keyword=test&page=2'),
    ).toBe('/neye/customers?keyword=test&page=2');
    expect(resolveCustomerListReturnTo('/neye/customers/customer-1')).toBe(
      '/neye/customers',
    );
    expect(resolveCustomerListReturnTo('https://example.com')).toBe(
      '/neye/customers',
    );
  });
});
