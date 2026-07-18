import { describe, expect, it } from 'vitest';

import {
  adjustOptometryValue,
  getOptometryQuickInputConfig,
  nextOptometryGridPosition,
} from './optometry-quick-input';

describe('optometry quick input', () => {
  it('uses coarse and fine steps for signed lens powers', () => {
    expect(adjustOptometryValue('Sph', '0.00', 1, 'coarse')).toBe('+1.00');
    expect(adjustOptometryValue('Sph', '-1.00', -1, 'fine')).toBe('-1.25');
    expect(adjustOptometryValue('Cyl', '-0.50', 1, 'fine')).toBe('-0.25');
  });

  it('clamps fields with a defined measurement range', () => {
    expect(adjustOptometryValue('Axis', '178', 1, 'coarse')).toBe('180');
    expect(adjustOptometryValue('Axis', '0', -1, 'fine')).toBe('0');
    expect(adjustOptometryValue('Prism', '0', -1, 'fine')).toBe('0.0');
  });

  it('exposes common presets for text fields', () => {
    expect(getOptometryQuickInputConfig('Base')?.values).toEqual([
      'BU 上',
      'BD 下',
      'BI 内',
      'BO 外',
    ]);
  });

  it('moves Tab horizontally and Enter vertically with wrapping', () => {
    expect(nextOptometryGridPosition(0, 1, 4, 3, 'right')).toEqual({
      columnIndex: 2,
      rowIndex: 0,
    });
    expect(nextOptometryGridPosition(0, 2, 4, 3, 'right')).toEqual({
      columnIndex: 0,
      rowIndex: 1,
    });
    expect(nextOptometryGridPosition(3, 1, 4, 3, 'down')).toEqual({
      columnIndex: 2,
      rowIndex: 0,
    });
  });
});