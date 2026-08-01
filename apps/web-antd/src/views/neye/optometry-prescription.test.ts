import { describe, expect, it } from 'vitest';

import {
  defaultOptometryExtraFieldOrder,
  defaultOptometryValueFieldOrder,
  moveOptometryField,
  normalizeOptometryFieldOrder,
  normalizeOptometryStyle,
  optometryValueFields,
  orderOptometryFields,
  showAllOptometryStyle,
} from './optometry-prescription';

describe('optometry prescription style order', () => {
  it('normalizes invalid, duplicate, and omitted fields', () => {
    expect(
      normalizeOptometryStyle({
        hiddenExtraFields: ['farPd', 'farPd', 'invalid'],
        hiddenValueFields: ['Sph', 'Sph', 'invalid'],
        valueFieldOrder: ['Axis', 'Axis', 'invalid'],
        extraFieldOrder: ['leftHeight', 'invalid', 'leftHeight'],
      }),
    ).toEqual({
      hiddenExtraFields: ['farPd'],
      hiddenValueFields: ['Sph'],
      valueFieldOrder: [
        'Axis',
        ...defaultOptometryValueFieldOrder.filter((field) => field !== 'Axis'),
      ],
      extraFieldOrder: [
        'leftHeight',
        ...defaultOptometryExtraFieldOrder.filter(
          (field) => field !== 'leftHeight',
        ),
      ],
      showRemark: true,
    });
  });

  it('adds canonical order to legacy styles without order fields', () => {
    const normalized = normalizeOptometryStyle({
      hiddenExtraFields: [],
      hiddenValueFields: [],
      showRemark: false,
    });

    expect(normalized.valueFieldOrder).toEqual(
      defaultOptometryValueFieldOrder,
    );
    expect(normalized.extraFieldOrder).toEqual(
      defaultOptometryExtraFieldOrder,
    );
    expect(normalized.showRemark).toBe(false);
  });

  it('shows every field without resetting custom field order', () => {
    const style = normalizeOptometryStyle({
      hiddenExtraFields: ['farPd'],
      hiddenValueFields: ['Sph'],
      valueFieldOrder: ['Axis', 'Sph'],
      extraFieldOrder: ['leftHeight', 'farPd'],
      showRemark: false,
    });

    const result = showAllOptometryStyle(style);

    expect(result.hiddenValueFields).toEqual([]);
    expect(result.hiddenExtraFields).toEqual([]);
    expect(result.showRemark).toBe(true);
    expect(result.valueFieldOrder).toEqual(style.valueFieldOrder);
    expect(result.extraFieldOrder).toEqual(style.extraFieldOrder);
  });

  it('orders definitions without mutating the canonical list', () => {
    const original = [...optometryValueFields];
    const ordered = orderOptometryFields(
      optometryValueFields,
      normalizeOptometryFieldOrder(
        ['Bcva', 'Sph'],
        defaultOptometryValueFieldOrder,
      ),
      (field) => field.suffix,
    );

    expect(ordered.slice(0, 3).map((field) => field.suffix)).toEqual([
      'Bcva',
      'Sph',
      'Cyl',
    ]);
    expect(optometryValueFields).toEqual(original);
  });

  it('moves a field to a target position and clamps boundaries', () => {
    const original = ['a', 'b', 'c'];

    expect(moveOptometryField(original, 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(moveOptometryField(original, 'c', -1)).toEqual(['c', 'a', 'b']);
    expect(moveOptometryField(original, 'missing', 1)).toEqual(original);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});