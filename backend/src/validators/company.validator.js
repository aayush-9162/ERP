const { body } = require('express-validator');

const companyValidation = [
  body('name').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('gst_number')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i)
    .withMessage('Invalid GST number format'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().matches(/^[+\d\s\-().]{6,20}$/).withMessage('Phone: 6-20 chars, digits/spaces/dashes allowed'),
  body('pincode').optional().isLength({ min: 6, max: 6 }).withMessage('Pincode must be 6 digits'),
];

module.exports = { companyValidation };
