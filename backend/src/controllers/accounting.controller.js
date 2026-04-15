const { Account } = require('../models');
const AccountingService = require('../services/accounting.service');
const ApiResponse = require('../utils/ApiResponse');

async function getAccounts(req, res, next) {
  try {
    const accounts = await AccountingService.getTrialBalance();
    ApiResponse.success(res, { accounts });
  } catch (e) { next(e); }
}

async function getAccountTransactions(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const offset = (page - 1) * limit;
    const { from, to } = req.query;

    const result = await AccountingService.getAccountTransactions(req.params.id, { from, to, limit, offset });
    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (e) { next(e); }
}

module.exports = { getAccounts, getAccountTransactions };
