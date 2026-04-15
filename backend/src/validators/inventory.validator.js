const { body } = require('express-validator');
const { UNITS } = require('../config/constants');

const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
];

const brandValidation = [
  body('name').trim().notEmpty().withMessage('Brand name is required'),
];

const createProductValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('sku').optional().trim(),
  body('barcode').optional().trim(),
  body('category_id').optional().isInt({ min: 1 }).withMessage('Valid category is required'),
  body('brand_id').optional().isInt({ min: 1 }).withMessage('Valid brand is required'),
  body('purchase_price').isFloat({ min: 0 }).withMessage('Purchase price must be >= 0'),
  body('selling_price').isFloat({ min: 0 }).withMessage('Selling price must be >= 0'),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be 0-100'),
  body('unit').optional().isIn(UNITS).withMessage(`Unit must be one of: ${UNITS.join(', ')}`),
  body('min_stock_alert').optional().isInt({ min: 0 }).withMessage('Min stock alert must be >= 0'),
];

const updateProductValidation = [
  body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
  body('sku').optional().trim(),
  body('barcode').optional().trim(),
  body('category_id').optional().isInt({ min: 1 }),
  body('brand_id').optional().isInt({ min: 1 }),
  body('purchase_price').optional().isFloat({ min: 0 }),
  body('selling_price').optional().isFloat({ min: 0 }),
  body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
  body('unit').optional().isIn(UNITS),
  body('min_stock_alert').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['active', 'inactive']),
];

const stockMovementValidation = [
  body('product_id').isInt({ min: 1 }).withMessage('Valid product is required'),
  body('type').isIn(['IN', 'OUT', 'ADJUSTMENT']).withMessage('Type must be IN, OUT, or ADJUSTMENT'),
  // quantity must be >= 1 for IN/OUT (sign handled by service).
  // For ADJUSTMENT, the controller passes it directly — but the frontend/API
  // always sends a positive number and the type determines the direction.
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reference').optional().trim().notEmpty(),
  body('notes').optional().trim(),
  body('warehouse_id').optional({ nullable: true }).isInt({ min: 1 }),
];

module.exports = {
  categoryValidation,
  brandValidation,
  createProductValidation,
  updateProductValidation,
  stockMovementValidation,
};
