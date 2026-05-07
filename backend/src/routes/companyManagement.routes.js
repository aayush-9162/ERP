const router = require('express').Router();
const ctrl = require('../controllers/companyManagement.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ctrl.getMyCompanies);
router.post('/', ctrl.createCompany);
router.post('/switch', ctrl.switchCompany);
router.put('/:id', ctrl.updateCompany);
router.get('/:id/team', ctrl.getTeam);
router.post('/:id/invite', ctrl.inviteUser);
router.delete('/:id/team/:userId', ctrl.removeUser);
router.post('/:id/team/:userId/reset-password', ctrl.resetMemberPassword);

module.exports = router;
