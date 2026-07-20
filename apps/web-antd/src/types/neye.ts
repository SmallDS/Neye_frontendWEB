export type UserRole = 'admin' | 'staff';
export type Gender = 'female' | 'male' | 'unknown';
export type ProductItemCategory = 'frame' | 'lens' | 'other';
export type TenantStatus = 'active' | 'disabled';
export type UserStatus = 'active' | 'disabled';
export type PickupNotificationStatus =
  | 'failed'
  | 'pending'
  | 'retrying'
  | 'sent'
  | 'unsubscribed';
export type PickupNotificationSource =
  | 'order_no'
  | 'pickup_tip'
  | 'store_phone'
  | 'store_name';

export type ImportTaskStatus =
  | 'canceled'
  | 'canceling'
  | 'completed'
  | 'failed'
  | 'pending'
  | 'running';
export type ImportTaskRowStatus = 'failed' | 'pending' | 'skipped' | 'success';
export type ImportTaskPhase =
  | 'cleanup'
  | 'finished'
  | 'parsing'
  | 'processing'
  | 'publishing'
  | 'uploaded';

export interface ImportCapabilities {
  maxFileBytes: number;
  maxRows: number;
  maxColumns: number;
  maxSheets: number;
  batchSize: number;
  workerConcurrency: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CurrentUser {
  id: string;
  tenantId?: null | string;
  tenantIds: string[];
  username: string;
  displayName: string;
  role: UserRole;
  tenant?: { code: string; id: string; name: string; status: TenantStatus };
  tenants: Array<Tenant & { assignedAt: string }>;
  wechatBound: boolean;
}

export interface LoginResult {
  accessToken: string;
  user: CurrentUser;
}

export interface Tenant {
  id: string;
  code: string;
  name: string;
  contactName?: null | string;
  contactPhone?: null | string;
  status: TenantStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  tenants: Array<Tenant & { assignedAt: string }>;
  createdAt: string;
  updatedAt?: string;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface TenantDetail extends Tenant {
  counts: {
    customers: number;
    fittingOrders: number;
    optometryOrders: number;
    users: number;
  };
  users: TenantUser[];
  recentCustomers: Customer[];
  recentOptometryOrders: OptometryOrder[];
  recentFittingOrders: FittingOrder[];
}

export interface OptometryStyleConfig {
  hiddenValueFields: string[];
  hiddenExtraFields: string[];
  showRemark: boolean;
}
export interface BatchDeleteResult {
  deletedCount: number;
  relatedDeleted?: Record<string, number>;
}
export interface ImportTaskRow {
  id: string;
  taskId: string;
  rowNo: number;
  importCustomerNo?: null | string;
  status: ImportTaskRowStatus;
  customerId?: null | string;
  optometryOrderId?: null | string;
  errorMessage?: null | string;
  rawData?: null | Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface ImportTask {
  id: string;
  tenantId: string;
  tenant?: Tenant;
  createdBy?: Pick<
    TenantUser,
    'displayName' | 'id' | 'role' | 'status' | 'username'
  >;
  type: 'customer_optometry';
  status: ImportTaskStatus;
  phase: ImportTaskPhase;
  fileName: string;
  totalRows: number;
  stagedRows: number;
  lastStagedRowNo: number;
  lastProcessedRowNo: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  errorMessage?: null | string;
  startedAt?: null | string;
  finishedAt?: null | string;
  publishedAt?: null | string;
  cancelRequestedAt?: null | string;
  rolledBackAt?: null | string;
  rollbackCustomers: number;
  rollbackOptometryOrders: number;
  rollbackFittingOrders: number;
  createdAt: string;
  updatedAt?: string;
  rows?: ImportTaskRow[];
}
export interface Customer {
  id: string;
  tenantId: string;
  customerNo: string;
  name: string;
  namePinyin?: null | string;
  nameInitials?: null | string;
  phone?: null | string;
  gender: Gender;
  age?: null | number;
  remark?: null | string;
  createdAt: string;
  optometryOrders?: OptometryOrder[];
  fittingOrders?: FittingOrder[];
}

export interface ProductItem {
  id: string;
  category: ProductItemCategory;
  name: string;
  defaultPrice: string;
  usageCount: number;
  lastUsedAt?: null | string;
  remark?: null | string;
}

export interface OptometryOrder {
  id: string;
  tenantId: string;
  orderNo: string;
  customerId: string;
  customer?: Customer;
  optometryDate: string;
  remark?: null | string;
  fittingOrders?: FittingOrder[];
  [key: string]: unknown;
}

export interface FittingOrder {
  id: string;
  tenantId: string;
  orderNo: string;
  customerId: string;
  customer?: Customer;
  optometryOrderId: string;
  optometryOrder?: OptometryOrder;
  frameProductItemId?: null | string;
  frameInfo?: null | string;
  framePrice: string;
  lensProductItemId?: null | string;
  lensInfo?: null | string;
  lensPrice: string;
  otherProductItemId?: null | string;
  otherInfo?: null | string;
  otherPrice: string;
  totalAmount: string;
  remark?: null | string;
  createdAt: string;
  readyForPickupAt?: null | string;
  pickupNotification?: PickupNotificationProjection;
}
export interface PickupNotificationProjection {
  status: PickupNotificationStatus;
  receiverSubscribed: boolean;
  receiverLocked: boolean;
  subscribedAt?: null | string;
  attempts: number;
  maxAttemptsPerCycle: number;
  nextRetryAt?: null | string;
  sentAt?: null | string;
  failureCode?: null | string;
  failureSummary?: null | string;
  qrExpiresAt?: null | string;
}

export interface PickupNotificationQr {
  qrCodeDataUrl: string;
  expiresAt: string;
  page: string;
}

export interface PickupNotificationAttempt {
  cycle: number;
  attemptNo: number;
  startedAt: string;
  finishedAt?: null | string;
  result: 'permanent_failure' | 'processing' | 'sent' | 'temporary_failure';
  wechatErrorCode?: null | number;
  errorSummary?: null | string;
  tokenRefreshed: boolean;
  nextRetryAt?: null | string;
}

export interface WechatPickupNotificationSettings {
  enabled: boolean;
  templateId: string;
  pickupTip: string;
  keywordMapping: Array<{
    keyword: string;
    source: PickupNotificationSource;
  }>;
  valid: boolean;
  validationErrors: string[];
}
export type SystemHealthStatus = 'error' | 'ok' | 'warning';

export interface AdminOverview {
  counts: {
    customers: number;
    fittingOrders: number;
    optometryOrders: number;
    productItems: number;
    tenants: { active: number; disabled: number; total: number };
    users: { active: number; disabled: number; total: number };
  };
  importTasks: {
    completed: number;
    failed: number;
    pending: number;
    running: number;
    successRate: number;
    total: number;
  };
  trends: {
    customers: number;
    fittingOrders: number;
    optometryOrders: number;
    periodDays: number;
  };
}

export interface SystemStatusCheck {
  name: string;
  status: SystemHealthStatus;
  message: string;
  latencyMs?: number;
}

export interface AdminSystemStatus {
  status: SystemHealthStatus;
  checkedAt: string;
  uptimeSeconds: number;
  memory: {
    heapTotalBytes: number;
    heapUsedBytes: number;
    rssBytes: number;
  };
  runtime: {
    nodeVersion: string;
    platform: string;
  };
  checks: SystemStatusCheck[];
}

export interface UserBatchStatusItem {
  userId: string;
  username?: string;
  success: boolean;
  message?: string;
}

export interface UserBatchStatusResult {
  updatedCount: number;
  status: UserStatus;
  userIds: string[];
}
export type EventLogLevel = 'ERROR' | 'INFO' | 'WARN';
export type EventLogCategory = 'AUDIT' | 'SECURITY' | 'SYSTEM';
export type EventLogResult = 'DENIED' | 'FAILED' | 'SUCCESS';
export type EventLogClearScope = 'all' | 'beforeDate';

export interface EventLog {
  id: string;
  level: EventLogLevel;
  category: EventLogCategory;
  result: EventLogResult;
  module: string;
  action: string;
  actorUserId?: null | string;
  actorUsername?: null | string;
  tenantId?: null | string;
  resourceType?: null | string;
  resourceId?: null | string;
  requestId?: null | string;
  ipAddress?: null | string;
  reason?: null | string;
  errorSummary?: null | string;
  metadata?: null | Record<string, unknown>;
  createdAt: string;
}

export interface EventLogQuery {
  page: number;
  pageSize: number;
  level?: EventLogLevel;
  category?: EventLogCategory;
  result?: EventLogResult;
  module?: string;
  actorUsername?: string;
  tenantId?: string;
  requestId?: string;
  resourceId?: string;
  startAt?: string;
  endAt?: string;
}

export interface EventLogRetention {
  retentionDays: number;
}

export interface EventLogRetentionResult extends EventLogRetention {
  deletedCount: number;
}

export interface EventLogClearSelection {
  scope: EventLogClearScope;
  beforeDate?: string;
}

export interface EventLogClearPreview extends EventLogClearSelection {
  cutoff?: string;
  expectedCount: number;
  confirmationText: string;
}

export interface EventLogClearPayload extends EventLogClearSelection {
  confirmationText: string;
  expectedCount: number;
  reason: string;
}

export interface EventLogClearResult {
  deletedCount: number;
  summaryLogId: string;
}
