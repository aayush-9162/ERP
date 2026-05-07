const router = require('express').Router();
const { register, login, getProfile, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { registerValidation, loginValidation, changePasswordValidation, updateProfileValidation } = require('../validators/auth.validator');

router.post('/register', validate(registerValidation), register);
router.post('/login', validate(loginValidation), login);
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, validate(updateProfileValidation), updateProfile);
router.post('/change-password', authenticate, validate(changePasswordValidation), changePassword);

module.exports = router;
