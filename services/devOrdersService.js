// Production shim for devOrdersService. The full implementation has been
// moved to `archive/dev_tools/services/devOrdersService.js` to keep dev-only
// logic out of production paths. During tests we delegate to the archived
// implementation so tests that rely on mock-order behavior can run.

// Mock orders have been removed from this codebase. Any attempt to use
// dev/mock order APIs or services will throw an explicit error so callers
// fail fast and tests are updated accordingly.

module.exports = {
  createMockOrder: async () => {
    throw new Error('Mock orders feature removed');
  },
  getMockOrderStats: async () => ({ totalCalls: 0, successfulCalls: 0, failedCalls: 0, idempotentCalls: 0 }),
};
