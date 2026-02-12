function assert(condition, message) {
  if (!condition) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
}

function requireString(v, field) {
  assert(typeof v === "string" && v.length > 0, `${field} is required`);
}

function requireNumber(v, field) {
  const n = typeof v === "number" ? v : (typeof v === "string" ? Number(v) : NaN);
  assert(Number.isFinite(n), `${field} must be a number`);
  return n;
}

module.exports = { assert, requireString, requireNumber };
