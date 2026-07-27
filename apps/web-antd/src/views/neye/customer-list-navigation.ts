export interface CustomerListState {
  keyword: string;
  page: number;
}

function queryValue(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

function positivePage(value: unknown) {
  const page = Number(queryValue(value));
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseCustomerListState(query: Record<string, unknown>) {
  return {
    keyword: queryValue(query.keyword),
    page: positivePage(query.page),
  } satisfies CustomerListState;
}

export function customerListPath(state: CustomerListState) {
  const params = new URLSearchParams();
  if (state.keyword) params.set('keyword', state.keyword);
  if (state.page > 1) params.set('page', String(state.page));
  const search = params.toString();
  return `/neye/customers${search ? `?${search}` : ''}`;
}

export function customerListLocation(state: CustomerListState) {
  return {
    path: '/neye/customers',
    query: {
      ...(state.keyword ? { keyword: state.keyword } : {}),
      ...(state.page > 1 ? { page: String(state.page) } : {}),
    },
  };
}

export function customerDetailLocation(
  customerId: string,
  listState: CustomerListState,
) {
  return {
    path: `/neye/customers/${customerId}`,
    query: { returnTo: customerListPath(listState) },
  };
}

export function resolveCustomerListReturnTo(value: unknown) {
  const returnTo = queryValue(value);
  if (
    returnTo === '/neye/customers' ||
    returnTo.startsWith('/neye/customers?')
  ) {
    return returnTo;
  }
  return '/neye/customers';
}
export function staleCustomerListTabKeys(
  tabs: Array<{ key?: unknown; name?: unknown }>,
) {
  return tabs.flatMap((tab) =>
    tab.name === 'NEyeCustomers' &&
    typeof tab.key === 'string' &&
    tab.key.startsWith('/neye/customers?')
      ? [tab.key]
      : [],
  );
}