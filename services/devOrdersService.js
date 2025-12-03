// Production shim for devOrdersService. The full implementation has been
// moved to `archive/dev_tools/services/devOrdersService.js` to keep dev-only
// logic out of production paths. During tests we delegate to the archived
// implementation so tests that rely on mock-order behavior can run.

if (process.env.NODE_ENV === 'test') {
  module.exports = require('../archive/dev_tools/services/devOrdersService');
} else {
  module.exports = {
    createMockOrder: async () => {
      throw new Error('devOrdersService is disabled in production');
    },
    getMockOrderStats: async () => ({ totalCalls: 0, successfulCalls: 0, failedCalls: 0, idempotentCalls: 0 }),
  };
}
