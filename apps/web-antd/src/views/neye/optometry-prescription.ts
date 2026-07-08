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
  showRemark: boolean;
}

export const defaultOptometryStyle: OptometryStyleConfig = {
  hiddenValueFields: [],
  hiddenExtraFields: [],
  showRemark: true,
};

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

const validSuffixes = new Set(optometryValueFields.map((field) => field.suffix));

export function optometryFieldName(group: string, suffix: string) {
  return `${group}${suffix}`;
}

export function normalizeOptometryStyle(value: (Partial<OptometryStyleConfig> & { hiddenCells?: string[] }) | null | undefined): OptometryStyleConfig {
  const hiddenValueFields = Array.isArray(value?.hiddenValueFields)
    ? value.hiddenValueFields
    : legacyHiddenCellsToFields(value?.hiddenCells);

  return {
    hiddenValueFields: hiddenValueFields.filter((field): field is OptometrySuffix => validSuffixes.has(field as OptometrySuffix)),
    hiddenExtraFields: Array.isArray(value?.hiddenExtraFields) ? value.hiddenExtraFields : [],
    showRemark: value?.showRemark !== false,
  };
}

export function hasTextValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function legacyHiddenCellsToFields(hiddenCells: unknown) {
  if (!Array.isArray(hiddenCells)) return [];
  return [...new Set(hiddenCells.map((cell) => String(cell).split('.')[1]).filter(Boolean))];
}