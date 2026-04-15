const GSTService = require('../services/gst.service');
const ApiResponse = require('../utils/ApiResponse');

async function getGSTR1(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await GSTService.getGSTR1({ from, to });
    ApiResponse.success(res, data);
  } catch (e) { next(e); }
}

async function getGSTR3B(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await GSTService.getGSTR3B({ from, to });
    ApiResponse.success(res, data);
  } catch (e) { next(e); }
}

// Export as CSV string
async function exportGSTR1CSV(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await GSTService.getGSTR1({ from, to });

    let csv = 'Invoice No,Date,Customer,GSTIN,Taxable Value,CGST,SGST,IGST,Invoice Value\n';
    for (const inv of [...data.b2b.invoices, ...data.b2c.invoices]) {
      csv += `${inv.invoice_number},${new Date(inv.invoice_date).toLocaleDateString('en-IN')},` +
        `"${inv.customer_name}",${inv.gst_number || ''},${inv.taxable_value},` +
        `${inv.cgst},${inv.sgst},${inv.igst},${inv.invoice_value}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=GSTR1_${from || 'all'}_${to || 'all'}.csv`);
    res.send(csv);
  } catch (e) { next(e); }
}

module.exports = { getGSTR1, getGSTR3B, exportGSTR1CSV };
