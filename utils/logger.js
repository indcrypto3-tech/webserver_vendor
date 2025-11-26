// Minimal structured JSON logger used across the app
function buildBase({ requestId, route, method, vendorId, orderId }) {
  return {
    timestamp: new Date().toISOString(),
    requestId: requestId || null,
    route: route || null,
    method: method || null,
    vendorId: vendorId || null,
    orderId: orderId || null,
  };
}

function info(meta, message) {
  const out = { level: 'info', message: message || null, ...meta };
  console.log(JSON.stringify(out));
}

function warn(meta, message) {
  const out = { level: 'warn', message: message || null, ...meta };
  console.warn(JSON.stringify(out));
}

function error(meta, message, stack) {
  const out = { level: 'error', message: message || null, stack: stack || null, ...meta };
  console.error(JSON.stringify(out));
}

module.exports = {
  buildBase,
  info,
  warn,
  error,
};
