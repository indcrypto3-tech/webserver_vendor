// MockOrderCall model moved to `archive/dev_tools/models/mockOrderCall.js`.
// During tests we delegate to the archived implementation. In production
// this module exposes a lightweight shim that throws if used.

if (process.env.NODE_ENV === 'test') {
  module.exports = require('../archive/dev_tools/models/mockOrderCall');
} else {
  // Minimal shim exposing the methods the code might call, but making them
  // no-ops or throwing to avoid accidental usage in production.
  const shim = {
    create: async () => { throw new Error('MockOrderCall model is disabled in production'); },
    findOne: async () => null,
    countDocuments: async () => 0,
    deleteMany: async () => ({ deletedCount: 0 }),
  };

  module.exports = shim;
}
