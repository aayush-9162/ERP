const { body } = require('express-validator');

const supplierValidation = [
  body('name').trim().notEmpty().withMessage('Supplier name is required'),
  body('phone').optional().matches(/^[+\d\s\-().]{6,20}$/).withMessage('Phone: 6-20 digits, may include +, -, spaces'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('gst_number')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i)
    .withMessage('Invalid GST number'),
];

const createPurchaseValidation = [
  body('supplier_id').isInt({ min: 1 }).withMessage('Valid supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Price must be >= 0'),
  body('items.*.tax_rate').optional().isFloat({ min: 0, max: 100 }),
  body('discount_amount').optional().isFloat({ min: 0 }),
  body('paid_amount').optional().isFloat({ min: 0 }),
  body('payment_method').optional().isIn(['CASH', 'UPI', 'BANK']),
  body('payments').optional().isArray(),
  body('payments.*.amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be > 0'),
  body('payments.*.method').isIn(['CASH', 'UPI', 'BANK']).withMessage('Payment method required'),
];

const supplierPaymentValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be > 0'),
  body('method').isIn(['CASH', 'UPI', 'BANK']).withMessage('Method must be CASH, UPI, or BANK'),
  body('reference').optional().trim(),
];

module.exports = { supplierValidation, createPurchaseValidation, supplierPaymentValidation };
