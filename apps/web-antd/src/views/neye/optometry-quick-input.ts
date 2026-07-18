export interface OptometryQuickInputConfig {
  coarseStep?: number;
  fineStep?: number;
  max?: number;
  min?: number;
  precision?: number;
  signed?: boolean;
  values: string[];
}

const quickInputConfigs: Record<string, OptometryQuickInputConfig> = {
  Sph: {
    coarseStep: 1,
    fineStep: 0.25,
    precision: 2,
    signed: true,
    values: [
      '-6.00', '-5.00', '-4.00', '-3.00', '-2.00', '-1.00', '-0.50',
      '-0.25', '0.00', '+0.25', '+0.50', '+1.00', '+2.00', '+3.00',
    ],
  },
  Cyl: {
    coarseStep: 1,
    fineStep: 0.25,
    precision: 2,
    signed: true,
    values: [
      '-3.00', '-2.00', '-1.50', '-1.00', '-0.75', '-0.50', '-0.25',
      '0.00', '+0.25', '+0.50',
    ],
  },
  Axis: {
    coarseStep: 10,
    fineStep: 1,
    max: 180,
    min: 0,
    precision: 0,
    values: [
      '0', '10', '30', '45', '60', '75', '90', '105', '120', '135',
      '150', '170', '180',
    ],
  },
  Prism: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['0', '0.5', '1', '1.5', '2', '3', '4', '5'],
  },
  Base: {
    values: ['BU 上', 'BD 下', 'BI 内', 'BO 外'],
  },
  Add: {
    coarseStep: 1,
    fineStep: 0.25,
    min: 0,
    precision: 2,
    signed: true,
    values: [
      '0.00', '+0.75', '+1.00', '+1.25', '+1.50', '+1.75', '+2.00',
      '+2.50', '+3.00',
    ],
  },
  BcV: { coarseStep: 0.5, fineStep: 0.1, min: 0, precision: 1, values: [] },
  BcH: { coarseStep: 0.5, fineStep: 0.1, min: 0, precision: 1, values: [] },
  Dia: { coarseStep: 1, fineStep: 0.1, min: 0, precision: 1, values: [] },
  Ucva: {
    coarseStep: 0.5,
    fineStep: 0.1,
    min: 0,
    precision: 1,
    values: ['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.8', '1.0', '1.2', '1.5'],
  },
  Bcva: {
    coarseStep: 0.5,
    fineStep: 0.1,
    min: 0,
    precision: 1,
    values: ['0.3', '0.4', '0.5', '0.6', '0.8', '1.0', '1.2', '1.5'],
  },
  farPd: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['54', '56', '58', '60', '62', '64', '66', '68', '70', '72'],
  },
  farRightPd: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['27', '28', '29', '30', '31', '32', '33', '34', '35', '36'],
  },
  farLeftPd: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['27', '28', '29', '30', '31', '32', '33', '34', '35', '36'],
  },
  nearPd: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['50', '52', '54', '56', '58', '60', '62', '64', '66'],
  },
  rightHeight: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25'],
  },
  leftHeight: {
    coarseStep: 1,
    fineStep: 0.5,
    min: 0,
    precision: 1,
    values: ['15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25'],
  },
};

export function getOptometryQuickInputConfig(fieldKey: string) {
  return quickInputConfigs[fieldKey];
}

export function adjustOptometryValue(
  fieldKey: string,
  currentValue: unknown,
  direction: -1 | 1,
  adjustment: 'coarse' | 'fine',
) {
  const config = getOptometryQuickInputConfig(fieldKey);
  const step = adjustment === 'coarse' ? config?.coarseStep : config?.fineStep;
  if (!config || step === undefined) return String(currentValue ?? '');

  const parsed = Number(String(currentValue ?? '').replace('+', ''));
  let next = (Number.isFinite(parsed) ? parsed : 0) + step * direction;
  if (config.min !== undefined) next = Math.max(config.min, next);
  if (config.max !== undefined) next = Math.min(config.max, next);
  if (Math.abs(next) < 0.000_001) next = 0;

  const value = next.toFixed(config.precision ?? 1);
  return config.signed && next > 0 ? `+${value}` : value;
}

export function nextOptometryGridPosition(
  rowIndex: number,
  columnIndex: number,
  rowCount: number,
  columnCount: number,
  movement: 'down' | 'left' | 'right' | 'up',
) {
  let nextRow = rowIndex;
  let nextColumn = columnIndex;

  if (movement === 'right') {
    nextColumn += 1;
    if (nextColumn >= columnCount) {
      nextColumn = 0;
      nextRow = (nextRow + 1) % rowCount;
    }
  } else if (movement === 'left') {
    nextColumn -= 1;
    if (nextColumn < 0) {
      nextColumn = columnCount - 1;
      nextRow = (nextRow - 1 + rowCount) % rowCount;
    }
  } else if (movement === 'down') {
    nextRow += 1;
    if (nextRow >= rowCount) {
      nextRow = 0;
      nextColumn = (nextColumn + 1) % columnCount;
    }
  } else {
    nextRow -= 1;
    if (nextRow < 0) {
      nextRow = rowCount - 1;
      nextColumn = (nextColumn - 1 + columnCount) % columnCount;
    }
  }

  return { columnIndex: nextColumn, rowIndex: nextRow };
}