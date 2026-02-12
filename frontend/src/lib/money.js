export function fmtAED(n) {
  const x = Number(n || 0);
  return `AED ${x.toFixed(2)}`;
}
