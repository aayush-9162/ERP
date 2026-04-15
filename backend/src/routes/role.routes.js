const router = require('express').Router();
const { getRoles } = require('../controllers/role.controller');
const { authenticate } = require('../middleware/auth');

router.get('/', getRoles);

module.exports = router;
