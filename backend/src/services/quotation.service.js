const { Op } = require('sequelize');
const { sequelize, Quotation, QuotationItem, Product, Sale } = require('../models');
const SalesService = require('./sales.service');
const ApiError = require('../utils/ApiError');
const { QUOTATION_STATUS } = require('../config/constants');

class QuotationService {
  static async _generateNumber(transaction) {
    const prefix = 'QUO';
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const last = await Quotation.findOne({
      where: { quotation_number: { [Op.like]: `${prefix}-${ym}-%` } },
      order: [['id', 'DESC']], transaction, lock: transaction.LOCK.UPDATE,
    });
    let seq = 1;
    if (last) seq = parseInt(last.quotation_number.split('-')[2], 10) + 1;
    return `${prefix}-${ym}-${String(seq).padStart(4, '0')}`;
  }

  static async create(data, user_id) {
    const transaction = await sequelize.transaction();
    try {
      const { customer_id, items, discount_amount = 0, valid_until, notes } = data;
      if (!items || items.length === 0) throw ApiError.badRequest('At least one item is required');

      const quotationItems = [];
      let subtotal = 0, totalTax = 0;

      for (const item of items) {
        const product = await Product.findByPk(item.product_id, { transaction });
        if (!product || product.status !== 'active') throw ApiError.badRequest(`Product ID ${item.product_id} not found`);

        const unitPrice = item.unit_price != null ? parseFloat(item.unit_price) : parseFloat(product.selling_price);
        const taxRate = parseFloat(product.tax_rate);
        const lineSub = unitPrice * item.quantity;
        const lineTax = Math.round(lineSub * taxRate) / 100;

        quotationItems.push({
          product_id: product.id, product_name: product.name, product_sku: product.sku,
          quantity: item.quantity, unit_price: unitPrice, tax_rate: taxRate,
          tax_amount: lineTax, total: Math.round((lineSub + lineTax) * 100) / 100,
        });
        subtotal += lineSub;
        totalTax += lineTax;
      }

      subtotal = Math.round(subtotal * 100) / 100;
      totalTax = Math.round(totalTax * 100) / 100;
      const effectiveDiscount = Math.min(parseFloat(discount_amount) || 0, subtotal + totalTax);
      const finalAmount = Math.round((subtotal + totalTax - effectiveDiscount) * 100) / 100;

      const qNum = await this._generateNumber(transaction);
      const quotation = await Quotation.create({
        quotation_number: qNum, customer_id: customer_id || null,
        total_amount: subtotal, tax_amount: totalTax,
        discount_amount: effectiveDiscount, final_amount: finalAmount,
        status: QUOTATION_STATUS.DRAFT, valid_until, notes, created_by: user_id,
      }, { transaction });

      await QuotationItem.bulkCreate(
        quotationItems.map((qi) => ({ ...qi, quotation_id: quotation.id })),
        { transaction }
      );

      await transaction.commit();
      return Quotation.findByPk(quotation.id, {
        include: [{ association: 'items' }, { association: 'customer' }, { association: 'createdBy', attributes: ['id', 'first_name', 'last_name'] }],
      });
    } catch (error) { await transaction.rollback(); throw error; }
  }

  static async updateStatus(id, status) {
    const quotation = await Quotation.findByPk(id);
    if (!quotation) throw ApiError.notFound('Quotation not found');
    if (quotation.status === QUOTATION_STATUS.CONVERTED) throw ApiError.badRequest('Cannot change status of converted quotation');
    await quotation.update({ status });
    return quotation;
  }

  static async convertToSale(quotation_id, { payment_method, paid_amount = 0 }, user_id) {
    const quotation = await Quotation.findByPk(quotation_id, { include: [{ association: 'items' }] });
    if (!quotation) throw ApiError.notFound('Quotation not found');
    if (quotation.status === QUOTATION_STATUS.CONVERTED) throw ApiError.badRequest('Quotation already converted');
    if (quotation.status === QUOTATION_STATUS.REJECTED) throw ApiError.badRequest('Cannot convert rejected quotation');

    const saleData = {
      customer_id: quotation.customer_id,
      items: quotation.items.map((i) => ({
        product_id: i.product_id, quantity: i.quantity, unit_price: parseFloat(i.unit_price),
      })),
      discount_amount: parseFloat(quotation.discount_amount),
      payment_method, paid_amount,
    };

    const sale = await SalesService.createSale(saleData, user_id);

    await quotation.update({
      status: QUOTATION_STATUS.CONVERTED,
      converted_sale_id: sale.id,
    });

    return { quotation: await Quotation.findByPk(quotation_id), sale };
  }
}

module.exports = QuotationService;
