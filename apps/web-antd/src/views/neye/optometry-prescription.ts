export type OptometryGroup = 'farRight' | 'farLeft' | 'nearRight' | 'nearLeft';
export type OptometrySuffix = 'Sph' | 'Cyl' | 'Axis' | 'Prism' | 'Base' | 'Add' | 'BcV' | 'BcH' | 'Dia' | 'Ucva' | 'Bcva';

export interface OptometryRowDef {
  purpose: '远用' | '近用';
  eye: '右' | '左';
  group: OptometryGroup;
  showPurpose: boolean;
}

export interface OptometryValueDef {
  suffix: OptometrySuffix;
  label: string;
  shortLabel: string;
}

export interface OptometryExtraFieldDef {
  key: string;
  label: string;
  compactLabel: string;
}

export interface OptometryStyleConfig {
  hiddenValueFields: string[];
  hiddenExtraFields: string[];
  valueFieldOrder: OptometrySuffix[];
  extraFieldOrder: string[];
  showRemark: boolean;
}

export const optometryRows: OptometryRowDef[] = [
  { purpose: '远用', eye: '右', group: 'farRight', showPurpose: true },
  { purpose: '远用', eye: '左', group: 'farLeft', showPurpose: false },
  { purpose: '近用', eye: '右', group: 'nearRight', showPurpose: true },
  { purpose: '近用', eye: '左', group: 'nearLeft', showPurpose: false },
];

export const optometryValueFields: OptometryValueDef[] = [
  { suffix: 'Sph', label: '球光', shortLabel: 'SPH' },
  { suffix: 'Cyl', label: '散光', shortLabel: 'CYL' },
  { suffix: 'Axis', label: '轴线', shortLabel: 'AXIS' },
  { suffix: 'Prism', label: '三棱', shortLabel: 'PRISM' },
  { suffix: 'Base', label: '基底', shortLabel: 'BASE' },
  { suffix: 'Add', label: '加光', shortLabel: 'ADD' },
  { suffix: 'BcV', label: '基弧V', shortLabel: 'BC-V' },
  { suffix: 'BcH', label: '基弧H', shortLabel: 'BC-H' },
  { suffix: 'Dia', label: '直径', shortLabel: 'DIA' },
  { suffix: 'Ucva', label: '裸眼视力', shortLabel: 'UCVA' },
  { suffix: 'Bcva', label: '矫正视力', shortLabel: 'BCVA' },
];

export const optometryExtraFields: OptometryExtraFieldDef[] = [
  { key: 'farPd', label: '远瞳距', compactLabel: '远瞳距' },
  { key: 'farRightPd', label: '远用右眼单眼瞳距', compactLabel: 'RPD' },
  { key: 'farLeftPd', label: '远用左眼单眼瞳距', compactLabel: 'LPD' },
  { key: 'nearPd', label: '近瞳距', compactLabel: '近瞳距' },
  { key: 'rightHeight', label: '右眼瞳高', compactLabel: 'Rh' },
  { key: 'leftHeight', label: '左眼瞳高', compactLabel: 'Lh' },
];

export const defaultOptometryValueFieldOrder = optometryValueFields.map(
  (field) => field.suffix,
);
export const defaultOptometryExtraFieldOrder = optometryExtraFields.map(
  (field) => field.key,
);

export const defaultOptometryStyle: OptometryStyleConfig = {
  hiddenValueFields: [],
  hiddenExtraFields: [],
  valueFieldOrder: defaultOptometryValueFieldOrder,
  extraFieldOrder: defaultOptometryExtraFieldOrder,
  showRemark: true,
};

const validSuffixes = new Set(defaultOptometryValueFieldOrder);
const validExtraFields = new Set(defaultOptometryExtraFieldOrder);

export function optometryFieldName(group: string, suffix: string) {
  return `${group}${suffix}`;
}

export function normalizeOptometryStyle(
  value:
    | (
        Omit<Partial<OptometryStyleConfig>, 'valueFieldOrder'> & {
          hiddenCells?: string[];
          valueFieldOrder?: string[];
        }
      )
    | null
    | undefined,
): OptometryStyleConfig {
  const hiddenValueFields = Array.isArray(value?.hiddenValueFields)
    ? value.hiddenValueFields
    : legacyHiddenCellsToFields(value?.hiddenCells);

  return {
    hiddenValueFields: [...new Set(hiddenValueFields)].filter(
      (field): field is OptometrySuffix =>
        validSuffixes.has(field as OptometrySuffix),
    ),
    hiddenExtraFields: [
      ...new Set(
        Array.isArray(value?.hiddenExtraFields)
          ? value.hiddenExtraFields
          : [],
      ),
    ].filter((field) => validExtraFields.has(field)),
    valueFieldOrder: normalizeOptometryFieldOrder(
      value?.valueFieldOrder,
      defaultOptometryValueFieldOrder,
    ),
    extraFieldOrder: normalizeOptometryFieldOrder(
      value?.extraFieldOrder,
      defaultOptometryExtraFieldOrder,
    ),
    showRemark: value?.showRemark !== false,
  };
}

export function showAllOptometryStyle(
  value: OptometryStyleConfig,
): OptometryStyleConfig {
  return {
    ...value,
    hiddenValueFields: [],
    hiddenExtraFields: [],
    showRemark: true,
  };
}

export function normalizeOptometryFieldOrder<T extends string>(
  value: null | readonly string[] | undefined,
  canonicalOrder: readonly T[],
): T[] {
  const validFields = new Set<string>(canonicalOrder);
  const normalized = [...new Set(value ?? [])].filter((field): field is T =>
    validFields.has(field),
  );
  for (const field of canonicalOrder) {
    if (!normalized.includes(field)) normalized.push(field);
  }
  return normalized;
}

export function orderOptometryFields<T>(
  fields: readonly T[],
  order: readonly string[],
  getKey: (field: T) => string,
): T[] {
  const positions = new Map(order.map((key, index) => [key, index]));
  return [...fields].sort(
    (left, right) =>
      (positions.get(getKey(left)) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(getKey(right)) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function moveOptometryField<T>(
  order: readonly T[],
  field: T,
  targetIndex: number,
): T[] {
  const currentIndex = order.indexOf(field);
  if (currentIndex < 0 || order.length < 2) return [...order];
  const nextIndex = Math.max(0, Math.min(targetIndex, order.length - 1));
  if (currentIndex === nextIndex) return [...order];
  const nextOrder = [...order];
  nextOrder.splice(currentIndex, 1);
  nextOrder.splice(nextIndex, 0, field);
  return nextOrder;
}

export function hasTextValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function legacyHiddenCellsToFields(hiddenCells: unknown) {
  if (!Array.isArray(hiddenCells)) return [];
  return [...new Set(hiddenCells.map((cell) => String(cell).split('.')[1]).filter(Boolean))];
}