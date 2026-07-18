export function customerDetailPath(customerId: string) {
  return `/neye/customers/${encodeURIComponent(customerId)}`;
}

export function nextCustomerSearchIndex(
  currentIndex: number,
  resultCount: number,
  direction: -1 | 1,
) {
  if (resultCount <= 0) return -1;
  if (currentIndex < 0) return direction > 0 ? 0 : resultCount - 1;
  return (currentIndex + direction + resultCount) % resultCount;
}