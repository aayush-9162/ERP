const { body } = require('express-validator');

const customerValidation = [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('phone').optional().matches(/^[+\d\s\-().]{6,20}$/).withMessage('Phone: 6-20 digits, may include +, -, spaces'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('gst_number')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i)
    .withMessage('Invalid GST number'),
];

const createSaleValidation = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Price must be >= 0'),
  body('customer_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('discount_amount').optional().isFloat({ min: 0 }).withMessage('Discount must be >= 0'),
  body('payment_method').optional().isIn(['CASH', 'UPI', 'CARD', 'MIXED']),
  body('paid_amount').optional().isFloat({ min: 0 }),
  body('payments').optional().isArray(),
  body('payments.*.amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be > 0'),
  body('payments.*.method').isIn(['CASH', 'UPI', 'CARD']).withMessage('Payment method required'),
];

const paymentValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be > 0'),
  body('method').isIn(['CASH', 'UPI', 'CARD']).withMessage('Method must be CASH, UPI, or CARD'),
  body('reference').optional().trim(),
];

module.exports = { customerValidation, createSaleValidation, paymentValidation };
