const { Op } = require('sequelize');
const { sequelize, Sale, SaleItem, Payment, Product, Inventory, StockMovement } = require('../models');
const StockService = require('./stock.service');
const ApiError = require('../utils/ApiError');
const { PAYMENT_STATUS, STOCK_REFERENCES } = require('../config/constants');

class SalesService {
  /**
   * Generate next invoice number inside a transaction to prevent duplicates.
   * Format: INV-YYYYMM-NNNN
   */
  static async _generateInvoiceNumber(transaction) {
    const prefix = 'INV';
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const last = await Sale.findOne({
      where: { invoice_number: { [Op.like]: `${prefix}-${ym}-%` } },
      order: [['id', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let seq = 1;
    if (last) {
      const parts = last.invoice_number.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
  }

  /**
   * Core sale creation — runs entirely in a transaction.
   *
   * @param {Object} data
   * @param {Array}  data.items           - [{ product_id, quantity, unit_price? }]
   * @param {number} data.customer_id     - null for walk-in
   * @param {number} data.discount_amount - flat discount on invoice
   * @param {string} data.payment_method  - CASH, UPI, CARD, MIXED
   * @param {number} data.paid_amount     - amount received
   * @param {Array}  data.payments        - [{ amount, method, reference }] for split payments
   * @param {string} data.notes
   * @param {number} user_id             - who is creating
   */
  static async createSale(data, user_id) {
    const transaction = await sequelize.transaction();

    try {
      const { company_id, items, customer_id, discount_amount = 0, payment_method, paid_amount = 0, payments: paymentSplits, notes, billing_address: billingOverride, delivery_address: deliveryOverride } = data;

      if (!items || items.length === 0) {
        throw ApiError.badRequest('At least one item is required');
      }

      // ---- 0. Merge duplicate product_ids in items array ----
      const mergedMap = new Map();
      for (const item of items) {
        const key = item.product_id;
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key);
          existing.quantity += item.quantity;
          // Keep the explicitly set unit_price if provided on either entry
          if (item.unit_price != null) existing.unit_price = item.unit_price;
        } else {
          mergedMap.set(key, { ...item });
        }
      }
      const mergedItems = Array.from(mergedMap.values());

      // ---- 1. Validate products and compute line items ----
      const saleItems = [];
      let subtotal = 0;
      let totalTax = 0;

      for (const item of mergedItems) {
        const product = await Product.findByPk(item.product_id, {
          include: [{ association: 'inventory', attributes: ['stock_quantity'] }],
          transaction,
        });

        if (!product || product.status !== 'active') {
          throw ApiError.badRequest(`Product ID ${item.product_id} not found or inactive`);
        }

        // Check stock availability
        const totalStock = product.inventory.reduce((sum, inv) => sum + inv.stock_quantity, 0);
        if (totalStock < item.quantity) {
          throw ApiError.badRequest(
            `Insufficient stock for "${product.name}". Available: ${totalStock}, requested: ${item.quantity}`
          );
        }

        // Lock price + tax at time of sale (override allowed via unit_price)
        const unitPrice = item.unit_price != null ? parseFloat(item.unit_price) : parseFloat(product.selling_price);
        const taxRate = parseFloat(product.tax_rate);
        const lineSubtotal = unitPrice * item.quantity;
        const lineTax = Math.round(lineSubtotal * taxRate) / 100;
        const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;

        saleItems.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: item.quantity,
          unit_price: unitPrice,
          tax_rate: taxRate,
          tax_amount: lineTax,
          total: lineTotal,
        });

        subtotal += lineSubtotal;
        totalTax += lineTax;
      }

      subtotal = Math.round(subtotal * 100) / 100;
      totalTax = Math.round(totalTax * 100) / 100;

      // Cap discount to prevent negative invoice totals
      const effectiveDiscount = Math.min(parseFloat(discount_amount) || 0, subtotal + totalTax);
      const finalAmount = Math.round((subtotal + totalTax - effectiveDiscount) * 100) / 100;

      // ---- 2. Determine payment status ----
      const effectivePaid = Math.min(parseFloat(paid_amount) || 0, finalAmount);
      let paymentStatus;
      if (effectivePaid >= finalAmount) {
        paymentStatus = PAYMENT_STATUS.PAID;
      } else if (effectivePaid > 0) {
        paymentStatus = PAYMENT_STATUS.PARTIAL;
      } else {
        paymentStatus = PAYMENT_STATUS.UNPAID;
      }

      // ---- 3. Create sale record ----
      const invoiceNumber = await SalesService._generateInvoiceNumber(transaction);

      // Snapshot the customer's addresses at this moment so future edits don't rewrite the invoice
      let billing_address = null;
      let delivery_address = null;
      if (billingOverride !== undefined) {
        billing_address = billingOverride || null;
      }
      if (deliveryOverride !== undefined) {
        delivery_address = deliveryOverride || null;
      }
      if ((billing_address === null || delivery_address === null) && customer_id) {
        const Customer = require('../models').Customer;
        const customer = await Customer.findByPk(customer_id, { transaction });
        if (customer) {
          if (billing_address === null && billingOverride === undefined) billing_address = customer.address || null;
          if (delivery_address === null && deliveryOverride === undefined) delivery_address = customer.delivery_address || null;
        }
      }

      const sale = await Sale.create({
        company_id,
        invoice_number: invoiceNumber,
        customer_id: customer_id || null,
        total_amount: subtotal,
        tax_amount: totalTax,
        discount_amount: effectiveDiscount,
        final_amount: finalAmount,
        paid_amount: effectivePaid,
        payment_status: paymentStatus,
        payment_method: payment_method || null,
        notes,
        billing_address,
        delivery_address,
        created_by: user_id,
      }, { transaction });

      // ---- 4. Create sale items ----
      const itemRecords = saleItems.map((si) => ({ ...si, sale_id: sale.id }));
      await SaleItem.bulkCreate(itemRecords, { transaction });

      // ---- 5. Deduct stock using atomic UPDATE (optimized v2) ----
      // The earlier stock check (step 1) was a snapshot read — an optimistic filter.
      // deductStockInTransaction does: UPDATE ... SET qty = qty - N WHERE qty - N >= 0
      // One SQL round-trip for the deduction, serialized by InnoDB's X-lock on the row.
      for (const si of saleItems) {
        try {
          await StockService.deductStockInTransaction(si.product_id, null, -si.quantity, transaction);
        } catch (err) {
          // Enrich the error with the product name
          if (err.statusCode === 400) {
            throw ApiError.badRequest(
              `Insufficient stock for "${si.product_name}". ${err.message.replace('Insufficient stock. ', '')}`
            );
          }
          throw err;
        }

        // Audit trail
        await StockMovement.create({
          product_id: si.product_id,
          warehouse_id: null,
          type: 'OUT',
          quantity: -si.quantity,
          reference: STOCK_REFERENCES.SALE,
          notes: `Sale ${invoiceNumber}`,
          created_by: user_id,
        }, { transaction });
      }

      // ---- 6. Record payment(s) ----
      if (paymentSplits && paymentSplits.length > 0) {
        const paymentRecords = paymentSplits.map((p) => ({
          sale_id: sale.id,
          amount: p.amount,
          method: p.method,
          reference: p.reference || null,
        }));
        await Payment.bulkCreate(paymentRecords, { transaction });
      } else if (effectivePaid > 0) {
        await Payment.create({
          sale_id: sale.id,
          amount: effectivePaid,
          method: payment_method || 'CASH',
          reference: null,
        }, { transaction });
      }

      await transaction.commit();

      // Return full sale with items
      const fullSale = await Sale.findByPk(sale.id, {
        include: [
          { association: 'items' },
          { association: 'customer' },
          { association: 'payments' },
          { association: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
        ],
      });

      return fullSale;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Record an additional payment against an existing sale.
   * Wrapped in a transaction so payment + sale update are atomic.
   */
  static async addPayment(sale_id, { amount, method, reference }) {
    const transaction = await sequelize.transaction();

    try {
      const sale = await Sale.findByPk(sale_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!sale) throw ApiError.notFound('Sale not found');

      if (sale.payment_status === PAYMENT_STATUS.PAID) {
        throw ApiError.badRequest('Sale is already fully paid');
      }

      const remaining = parseFloat(sale.final_amount) - parseFloat(sale.paid_amount);
      if (remaining <= 0) {
        throw ApiError.badRequest('No balance remaining');
      }

      const payAmount = Math.min(parseFloat(amount), remaining);

      const payment = await Payment.create({
        sale_id,
        amount: payAmount,
        method,
        reference: reference || null,
      }, { transaction });

      const newPaid = Math.round((parseFloat(sale.paid_amount) + payAmount) * 100) / 100;
      const newStatus = newPaid >= parseFloat(sale.final_amount) ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIAL;

      await sale.update({
        paid_amount: newPaid,
        payment_status: newStatus,
      }, { transaction });

      await transaction.commit();

      return { payment, sale: await Sale.findByPk(sale_id) };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Sales summary stats for dashboard.
   * Single query with conditional aggregation — 1 table scan instead of 3.
   * Scopes by company_id when provided (super-admin can pass null for global).
   */
  static async getSalesSummary(companyId = null) {
    const [[row]] = await sequelize.query(`
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(final_amount), 0) AS total_revenue,
        SUM(CASE WHEN created_at >= CURDATE() THEN 1 ELSE 0 END) AS today_count,
        COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN final_amount ELSE 0 END), 0) AS today_revenue,
        SUM(CASE WHEN payment_status != 'PAID' THEN 1 ELSE 0 END) AS unpaid_count,
        COALESCE(SUM(CASE WHEN payment_status != 'PAID' THEN (final_amount - paid_amount) ELSE 0 END), 0) AS unpaid_amount
      FROM sales
      ${companyId ? 'WHERE company_id = :cid' : ''}
    `, { replacements: { cid: companyId } });

    return {
      total_invoices: parseInt(row.total_count) || 0,
      total_revenue: parseFloat(row.total_revenue) || 0,
      today_invoices: parseInt(row.today_count) || 0,
      today_revenue: parseFloat(row.today_revenue) || 0,
      unpaid_invoices: parseInt(row.unpaid_count) || 0,
      unpaid_amount: parseFloat(row.unpaid_amount) || 0,
    };
  }
}

module.exports = SalesService;
