import type {
  ImportTask,
  ImportTaskPhase,
  ImportTaskStatus,
} from '#/types/neye';

export type ImportProgressStatus =
  | 'active'
  | 'exception'
  | 'normal'
  | 'success';

export type ImportTaskRecord = ImportTask & { key?: string };

const activeStatuses = new Set<ImportTaskStatus>([
  'canceling',
  'pending',
  'running',
]);

const terminalStatuses = new Set<ImportTaskStatus>([
  'canceled',
  'completed',
  'failed',
]);

const statusInfo: Record<ImportTaskStatus, { color: string; text: string }> = {
  canceled: { color: 'default', text: '已取消' },
  canceling: { color: 'orange', text: '取消中' },
  completed: { color: 'green', text: '已完成' },
  failed: { color: 'red', text: '失败' },
  pending: { color: 'blue', text: '等待中' },
  running: { color: 'processing', text: '导入中' },
};

const phaseText: Record<ImportTaskPhase, string> = {
  cleanup: '清理中',
  finished: '已结束',
  parsing: '解析并暂存',
  processing: '分批处理',
  publishing: '原子发布',
  uploaded: '等待解析',
};

export function taskStatusInfo(status: ImportTaskStatus) {
  return statusInfo[status];
}

export function taskPhaseText(phase: ImportTaskPhase) {
  return phaseText[phase];
}

export function taskProgressText(task: ImportTask) {
  if (task.phase === 'parsing') {
    return `已暂存 ${task.stagedRows}/${task.totalRows || '?'}`;
  }
  if (task.phase === 'publishing') return '正在原子发布，请勿关闭服务';
  if (task.phase === 'cleanup') return '正在清理未发布数据';
  return `${task.processedRows}/${task.totalRows}`;
}

export function rowStatusText(status: string) {
  if (status === 'failed') return '失败';
  if (status === 'skipped') return '已跳过';
  return status;
}

export function progressPercent(task: ImportTask) {
  if (task.status === 'completed') return 100;
  if (!task.totalRows) return 0;
  const completed =
    task.phase === 'parsing' ? task.stagedRows : task.processedRows;
  const percent = Math.round((completed / task.totalRows) * 100);
  return task.phase === 'publishing' ? 99 : Math.min(100, percent);
}

export function progressStatus(task: ImportTask): ImportProgressStatus {
  if (task.status === 'failed' || task.failedRows > 0) return 'exception';
  if (task.status === 'running') return 'active';
  if (task.status === 'completed') return 'success';
  return 'normal';
}

export function isImportTaskActive(task: ImportTask) {
  return activeStatuses.has(task.status);
}

export function canCancelImportTask(task: ImportTask) {
  return (
    (task.status === 'pending' || task.status === 'running') &&
    task.phase !== 'publishing'
  );
}

export function canDeleteImportTask(task: ImportTask) {
  return !isImportTaskActive(task);
}

export function canRollbackImportTask(task: ImportTask) {
  return (
    terminalStatuses.has(task.status) &&
    !task.rolledBackAt &&
    task.successRows > 0
  );
}

export function taskIdOf(task: ImportTaskRecord) {
  return task.id || task.key;
}

export function importTaskErrorLogs(task: ImportTask | null) {
  if (!task) return [];
  const lines: string[] = [];
  if (task.errorMessage) lines.push(`[任务] ${task.errorMessage}`);
  for (const row of task.rows || []) {
    if (row.status !== 'failed' && row.status !== 'skipped') continue;
    const customerNo = row.importCustomerNo
      ? ` / 客户 ${row.importCustomerNo}`
      : '';
    lines.push(
      `第 ${row.rowNo} 行${customerNo}：${row.errorMessage || rowStatusText(row.status)}`,
    );
  }
  return lines;
}

export function importTaskRollbackSummary(task: ImportTask | null) {
  if (!task?.rolledBackAt) return '';
  return `已回滚：客户 ${task.rollbackCustomers || 0}，验光单 ${task.rollbackOptometryOrders || 0}，配镜单 ${task.rollbackFittingOrders || 0}`;
}
