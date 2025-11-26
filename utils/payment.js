const crypto = require('crypto');

/**
 * Generate a unique payment request ID
 * @returns {string} UUID v4
 */
function generatePaymentRequestId() {
  return crypto.randomUUID();
}

/**
 * Validate payment request amount
 * @param {number} amount - Amount to validate
 * @returns {boolean} True if valid
 */
function validateAmount(amount) {
  return typeof amount === 'number' && amount > 0 && isFinite(amount);
}

/**
 * Create a payment request object
 * @param {Object} params
 * @param {number} params.amount - Payment amount
 * @param {string} params.currency - Currency code (default: INR)
 * @param {string} params.notes - Optional notes
 * @returns {Object} Payment request object
 */
function createPaymentRequest({ amount, currency = 'INR', notes = '' }) {
  if (!validateAmount(amount)) {
    throw new Error('Invalid amount: must be a positive number');
  }

  return {
    id: generatePaymentRequestId(),
    amount,
    currency,
    notes,
    status: 'requested',
    createdAt: new Date(),
    confirmedAt: null,
    meta: {},
  };
}

/**
 * Confirm a payment request
 * @param {Object} paymentRequest - Payment request to confirm
 * @returns {Object} Updated payment request
 */
function confirmPaymentRequest(paymentRequest) {
  return {
    ...paymentRequest,
    status: 'confirmed',
    confirmedAt: new Date(),
  };
}

module.exports = {
  generatePaymentRequestId,
  validateAmount,
  createPaymentRequest,
  confirmPaymentRequest,
};
