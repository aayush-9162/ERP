const ReportsService = require('../services/reports.service');
const ApiResponse = require('../utils/ApiResponse');

async function salesReport(req, res, next) {
  try {
    const { from, to, group_by } = req.query;
    const data = await ReportsService.salesReport({ from, to, group_by });
    ApiResponse.success(res, { report: data });
  } catch (e) { next(e); }
}

async function topProducts(req, res, next) {
  try {
    const { from, to, limit } = req.query;
    const data = await ReportsService.topSellingProducts({ from, to, limit });
    ApiResponse.success(res, { products: data });
  } catch (e) { next(e); }
}

async function purchaseReport(req, res, next) {
  try {
    const { from, to, group_by } = req.query;
    const data = await ReportsService.purchaseReport({ from, to, group_by });
    ApiResponse.success(res, { report: data });
  } catch (e) { next(e); }
}

async function supplierReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await ReportsService.supplierWiseReport({ from, to });
    ApiResponse.success(res, { report: data });
  } catch (e) { next(e); }
}

async function inventoryValuation(req, res, next) {
  try {
    const data = await ReportsService.inventoryValuation();
    ApiResponse.success(res, data);
  } catch (e) { next(e); }
}

async function profitAndLoss(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await ReportsService.profitAndLoss({ from, to });
    ApiResponse.success(res, data);
  } catch (e) { next(e); }
}

async function customerReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await ReportsService.customerReport({ from, to });
    ApiResponse.success(res, { customers: data });
  } catch (e) { next(e); }
}

async function customerLedger(req, res, next) {
  try {
    const data = await ReportsService.customerLedger(req.params.id);
    ApiResponse.success(res, data);
  } catch (e) { next(e); }
}

module.exports = { salesReport, topProducts, purchaseReport, supplierReport, inventoryValuation, profitAndLoss, customerReport, customerLedger };
