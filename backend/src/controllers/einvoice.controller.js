const EInvoiceService = require('../services/einvoice.service');
const ApiResponse = require('../utils/ApiResponse');

async function generateEInvoice(req, res, next) {
  try {
    const result = await EInvoiceService.generate(req.params.id);
    ApiResponse.success(res, result, 'E-invoice generated');
  } catch (e) { next(e); }
}

module.exports = { generateEInvoice };
