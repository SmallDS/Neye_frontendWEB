import type { ImportTask } from '#/types/neye';

import { describe, expect, it } from 'vitest';

import {
  canCancelImportTask,
  canDeleteImportTask,
  canRollbackImportTask,
  importTaskErrorLogs,
  importTaskRollbackSummary,
  isImportTaskActive,
  progressPercent,
  progressStatus,
  taskPhaseText,
  taskProgressText,
  taskStatusInfo,
} from './view';

function createTask(overrides: Partial<ImportTask> = {}): ImportTask {
  return {
    createdAt: '2026-08-28T00:00:00Z',
    failedRows: 0,
    fileName: 'customers.xlsx',
    id: 'task-1',
    lastProcessedRowNo: 0,
    lastStagedRowNo: 0,
    phase: 'processing',
    processedRows: 20,
    rollbackCustomers: 0,
    rollbackFittingOrders: 0,
    rollbackOptometryOrders: 0,
    stagedRows: 20,
    status: 'running',
    successRows: 20,
    tenantId: 'tenant-1',
    totalRows: 100,
    type: 'customer_optometry',
    ...overrides,
  };
}

describe('import task view helpers', () => {
  it('maps task state to stable labels', () => {
    expect(taskStatusInfo('running')).toEqual({
      color: 'processing',
      text: '导入中',
    });
    expect(taskPhaseText('publishing')).toBe('原子发布');
  });

  it('describes parsing, publishing, cleanup and normal progress', () => {
    expect(
      taskProgressText(createTask({ phase: 'parsing', stagedRows: 12 })),
    ).toBe('已暂存 12/100');
    expect(taskProgressText(createTask({ phase: 'publishing' }))).toContain(
      '原子发布',
    );
    expect(taskProgressText(createTask({ phase: 'cleanup' }))).toContain(
      '清理',
    );
    expect(taskProgressText(createTask())).toBe('20/100');
  });

  it('calculates bounded progress and reserves publishing completion', () => {
    expect(progressPercent(createTask())).toBe(20);
    expect(progressPercent(createTask({ phase: 'publishing' }))).toBe(99);
    expect(progressPercent(createTask({ processedRows: 120 }))).toBe(100);
    expect(progressPercent(createTask({ totalRows: 0 }))).toBe(0);
    expect(progressPercent(createTask({ status: 'completed' }))).toBe(100);
  });

  it('derives progress style from failures and lifecycle state', () => {
    expect(progressStatus(createTask())).toBe('active');
    expect(progressStatus(createTask({ failedRows: 1 }))).toBe('exception');
    expect(progressStatus(createTask({ status: 'completed' }))).toBe('success');
    expect(progressStatus(createTask({ status: 'pending' }))).toBe('normal');
  });

  it('guards cancellation, deletion and rollback actions', () => {
    const running = createTask();
    const publishing = createTask({ phase: 'publishing' });
    const completed = createTask({ status: 'completed' });
    const rolledBack = createTask({
      rolledBackAt: '2026-08-28T01:00:00Z',
      status: 'completed',
    });

    expect(isImportTaskActive(running)).toBe(true);
    expect(canCancelImportTask(running)).toBe(true);
    expect(canCancelImportTask(publishing)).toBe(false);
    expect(canDeleteImportTask(running)).toBe(false);
    expect(canDeleteImportTask(completed)).toBe(true);
    expect(canRollbackImportTask(completed)).toBe(true);
    expect(canRollbackImportTask(rolledBack)).toBe(false);
  });

  it('builds readable error and rollback summaries', () => {
    const task = createTask({
      errorMessage: '文件解析失败',
      rollbackCustomers: 2,
      rollbackFittingOrders: 1,
      rollbackOptometryOrders: 2,
      rolledBackAt: '2026-08-28T01:00:00Z',
      rows: [
        {
          createdAt: '2026-08-28T00:00:00Z',
          errorMessage: '手机号无效',
          id: 'row-1',
          importCustomerNo: 'C001',
          rowNo: 2,
          status: 'failed',
          taskId: 'task-1',
        },
        {
          createdAt: '2026-08-28T00:00:00Z',
          id: 'row-2',
          rowNo: 3,
          status: 'success',
          taskId: 'task-1',
        },
      ],
    });

    expect(importTaskErrorLogs(task)).toEqual([
      '[任务] 文件解析失败',
      '第 2 行 / 客户 C001：手机号无效',
    ]);
    expect(importTaskRollbackSummary(task)).toBe(
      '已回滚：客户 2，验光单 2，配镜单 1',
    );
  });
});
