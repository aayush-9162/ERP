const router = require('express').Router();
const { getUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createUserValidation, updateUserValidation } = require('../validators/user.validator');
const { ROLES } = require('../config/constants');

// All user routes require authentication

router.get('/', authorize(ROLES.ADMIN, ROLES.MANAGER), getUsers);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.MANAGER), getUser);
router.post('/', authorize(ROLES.ADMIN), validate(createUserValidation), createUser);
router.put('/:id', authorize(ROLES.ADMIN), validate(updateUserValidation), updateUser);
router.delete('/:id', authorize(ROLES.ADMIN), deleteUser);

module.exports = router;
