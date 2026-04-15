const { body } = require('express-validator');

const createQuotationValidation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be >= 1'),
  body('items.*.unit_price').optional().isFloat({ min: 0 }),
  body('customer_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('discount_amount').optional().isFloat({ min: 0 }),
  body('valid_until').optional().isISO8601().withMessage('Valid date required'),
];

const updateStatusValidation = [
  body('status').isIn(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']).withMessage('Invalid status'),
];

const convertValidation = [
  body('payment_method').optional().isIn(['CASH', 'UPI', 'CARD', 'MIXED']),
  body('paid_amount').optional().isFloat({ min: 0 }),
];

module.exports = { createQuotationValidation, updateStatusValidation, convertValidation };
