// MockOrderCall model moved to `archive/dev_tools/models/mockOrderCall.js`.
// During tests we delegate to the archived implementation. In production
// this module exposes a lightweight shim that throws if used.

// Mock order audit model removed. This shim ensures any accidental usage
// fails fast. If you depend on audit records, migrate to a production
// audit/logging approach instead of mock endpoints.

module.exports = {
  create: async () => { throw new Error('MockOrderCall model removed'); },
  findOne: async () => null,
  countDocuments: async () => 0,
  deleteMany: async () => ({ deletedCount: 0 }),
};
