const crypto = require('crypto');
const { Sale, SaleItem, Customer, Company } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * E-Invoice service for India (mock implementation).
 * In production, this would call the NIC e-Invoice API.
 * Currently generates mock IRN and QR codes.
 */
class EInvoiceService {
  /**
   * Generate e-invoice for a sale.
   * Validates that the sale has a GST-registered customer.
   */
  static async generate(sale_id) {
    const { Product } = require('../models');
    const sale = await Sale.findByPk(sale_id, {
      include: [
        { association: 'items', include: [{ model: Product, as: 'product', attributes: ['hsn_code'] }] },
        { association: 'customer' },
      ],
    });

    if (!sale) throw ApiError.notFound('Sale not found');
    if (sale.e_invoice_status === 'GENERATED') throw ApiError.badRequest('E-invoice already generated');
    if (!sale.customer_id) throw ApiError.badRequest('E-invoice requires a registered customer (not walk-in)');
    if (!sale.customer?.gst_number) throw ApiError.badRequest('Customer GST number required for e-invoicing');

    const company = await Company.findOne();
    if (!company?.gst_number) throw ApiError.badRequest('Company GST number not configured');

    try {
      // Build e-invoice payload (NIC schema simplified)
      const payload = {
        Version: '1.1',
        TranDtls: { TaxSch: 'GST', SupTyp: 'B2B', RegRev: 'N' },
        DocDtls: {
          Typ: 'INV', No: sale.invoice_number,
          Dt: new Date(sale.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        },
        SellerDtls: {
          Gstin: company.gst_number, LglNm: company.name,
          Addr1: company.address_line1 || '', Loc: company.city || '',
          Pin: parseInt(company.pincode) || 0, Stcd: company.gst_number.substring(0, 2),
        },
        BuyerDtls: {
          Gstin: sale.customer.gst_number, LglNm: sale.customer.name,
          Pos: sale.customer.gst_number.substring(0, 2),
        },
        ItemList: sale.items.map((item, idx) => {
          const itemTax = parseFloat(item.tax_amount);
          const sellerState = company.gst_number.substring(0, 2);
          const buyerState = sale.customer.gst_number.substring(0, 2);
          const isInterState = sellerState !== buyerState;
          const cgst = isInterState ? 0 : Math.floor(itemTax * 100 / 2) / 100;
          const sgst = isInterState ? 0 : Math.round((itemTax - cgst) * 100) / 100;
          const igst = isInterState ? itemTax : 0;

          return {
            SlNo: String(idx + 1),
            PrdDesc: item.product_name, IsServc: 'N',
            HsnCd: item.product?.hsn_code || '00000000',
            Qty: item.quantity, Unit: 'NOS',
            UnitPrice: parseFloat(item.unit_price),
            TotAmt: parseFloat(item.unit_price) * item.quantity,
            GstRt: parseFloat(item.tax_rate),
            CgstAmt: cgst, SgstAmt: sgst, IgstAmt: igst,
            TotItemVal: parseFloat(item.total),
          };
        }),
        ValDtls: (() => {
          const sellerState = company.gst_number.substring(0, 2);
          const buyerState = sale.customer.gst_number.substring(0, 2);
          const isInterState = sellerState !== buyerState;
          const totalTax = parseFloat(sale.tax_amount);
          return {
            AssVal: parseFloat(sale.total_amount),
            CgstVal: isInterState ? 0 : Math.floor(totalTax * 100 / 2) / 100,
            SgstVal: isInterState ? 0 : Math.round((totalTax - Math.floor(totalTax * 100 / 2) / 100) * 100) / 100,
            IgstVal: isInterState ? totalTax : 0,
            Discount: parseFloat(sale.discount_amount),
            TotInvVal: parseFloat(sale.final_amount),
          };
        })(),
      };

      // Mock IRN generation (in production: POST to NIC API)
      const irn = crypto.createHash('sha256')
        .update(`${company.gst_number}|${sale.invoice_number}|${payload.DocDtls.Dt}`)
        .digest('hex');

      // Mock QR code data (in production: signed JWT from NIC)
      const qrData = JSON.stringify({
        SellerGstin: company.gst_number,
        BuyerGstin: sale.customer.gst_number,
        DocNo: sale.invoice_number,
        DocDt: payload.DocDtls.Dt,
        TotVal: parseFloat(sale.final_amount),
        Irn: irn,
      });

      // Update sale with e-invoice data
      await sale.update({
        irn,
        qr_code: qrData,
        e_invoice_status: 'GENERATED',
      });

      return {
        irn,
        qr_code: qrData,
        status: 'GENERATED',
        payload,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      await sale.update({ e_invoice_status: 'FAILED' });
      throw ApiError.internal(`E-invoice generation failed: ${error.message}`);
    }
  }
}

module.exports = EInvoiceService;
