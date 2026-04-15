const { body } = require('express-validator');

const createUserValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role_id').isInt({ min: 1 }).withMessage('Valid role is required'),
  body('phone').optional().matches(/^[+\d\s\-().]{6,20}$/).withMessage('Phone: 6-20 digits, may include +, -, spaces'),
];

const updateUserValidation = [
  body('first_name').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[+\d\s\-().]{6,20}$/).withMessage('Phone: 6-20 digits, may include +, -, spaces'),
  body('role_id').optional().isInt({ min: 1 }).withMessage('Valid role is required'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
];

module.exports = { createUserValidation, updateUserValidation };
