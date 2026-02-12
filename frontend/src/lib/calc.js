export function calcSubtotal(items) {
  return (items || []).reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
}

export function calcTax(subtotal, taxPercent) {
  return (Number(subtotal) * Number(taxPercent || 0)) / 100;
}

export function calcService(subtotal, serviceChargePercent) {
  return (Number(subtotal) * Number(serviceChargePercent || 0)) / 100;
}

export function calcTotal(subtotal, tax, service) {
  return Number(subtotal) + Number(tax) + Number(service);
}

export function orderPrepSeconds(order) {
  if (!order?.doneAt || !order?.createdAt) return null;
  const a = new Date(order.createdAt).getTime();
  const b = new Date(order.doneAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 1000));
}
