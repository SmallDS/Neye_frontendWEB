import type { FittingOrder, OptometryOrder } from '#/types/neye';

export function sortOptometryOrders(orders: OptometryOrder[]) {
  return [...orders].sort((left, right) => {
    const dateResult = String(right.optometryDate ?? '').localeCompare(
      String(left.optometryDate ?? ''),
    );
    if (dateResult !== 0) return dateResult;
    return String(right.orderNo ?? '').localeCompare(String(left.orderNo ?? ''));
  });
}

export function resolveWorkspaceSelection(
  orders: OptometryOrder[],
  fittings: FittingOrder[],
  optometryId?: string,
  fittingId?: string,
) {
  const fitting = fittingId
    ? fittings.find((item) => item.id === fittingId)
    : undefined;
  const requestedOrderId = fitting?.optometryOrderId || optometryId;
  const selectedOrder = requestedOrderId
    ? orders.find((item) => item.id === requestedOrderId)
    : orders[0];

  return {
    fitting,
    optometryId: selectedOrder?.id,
  };
}

export function customerWorkspaceLocation(
  customerId: string,
  optometryId?: string,
  fittingId?: string,
) {
  return {
    path: `/neye/customers/${customerId}`,
    query: {
      ...(optometryId ? { optometryId } : {}),
      ...(fittingId ? { fittingId } : {}),
    },
  };
}