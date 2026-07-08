export type UserRole = 'admin' | 'staff';
export type Gender = 'male' | 'female' | 'unknown';
export type ProductItemCategory = 'frame' | 'lens' | 'other';
export type TenantStatus = 'active' | 'disabled';
export type UserStatus = 'active' | 'disabled';
export type ImportTaskStatus = 'pending' | 'running' | 'canceling' | 'canceled' | 'completed' | 'failed';
export type ImportTaskRowStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CurrentUser {
  id: string;
  tenantId?: null | string;
  username: string;
  displayName: string;
  role: UserRole;
  tenant?: { code: string; id: string; name: string };
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
    users: number;
    customers: number;
    optometryOrders: number;
    fittingOrders: number;
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
  createdBy?: Pick<TenantUser, 'displayName' | 'id' | 'role' | 'status' | 'username'>;
  type: 'customer_optometry';
  status: ImportTaskStatus;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  errorMessage?: null | string;
  startedAt?: null | string;
  finishedAt?: null | string;
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
}