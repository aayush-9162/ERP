const { sequelize, Account, Transaction } = require('../models');

/**
 * Lightweight double-entry-style accounting service.
 * Each business event creates one or more transactions against named accounts.
 * Account.balance is updated atomically for fast reads.
 */
class AccountingService {
  // Cache account IDs by name to avoid repeated lookups
  static _cache = {};

  static async _getAccountId(name) {
    if (this._cache[name]) return this._cache[name];
    const acc = await Account.findOne({ where: { name } });
    if (acc) this._cache[name] = acc.id;
    return acc?.id;
  }

  /**
   * Record a transaction: debit or credit an account.
   * Updates account.balance atomically.
   */
  static async record({ accountName, type, amount, referenceType, referenceId, description, transaction: tx }) {
    const accountId = await this._getAccountId(accountName);
    if (!accountId) return null; // Account not seeded — skip gracefully

    const entry = await Transaction.create({
      account_id: accountId,
      type,
      amount,
      reference_type: referenceType,
      reference_id: referenceId,
      description,
    }, { transaction: tx });

    // Update running balance: DEBIT adds to ASSET/EXPENSE, subtracts from INCOME/LIABILITY
    // CREDIT is the reverse. Simplified: store raw delta and let reports interpret.
    const delta = type === 'DEBIT' ? amount : -amount;
    await sequelize.query(
      'UPDATE accounts SET balance = balance + :delta, updated_at = NOW() WHERE id = :id',
      { replacements: { delta, id: accountId }, transaction: tx }
    );

    return entry;
  }

  /**
   * Record accounting entries for a completed sale.
   */
  static async recordSale(sale, tx) {
    const desc = `Sale ${sale.invoice_number}`;
    // Receivable / Cash DEBIT (asset increases)
    await this.record({ accountName: 'Accounts Receivable', type: 'DEBIT', amount: parseFloat(sale.final_amount), referenceType: 'sale', referenceId: sale.id, description: desc, transaction: tx });
    // Sales Income CREDIT (income increases)
    await this.record({ accountName: 'Sales Income', type: 'CREDIT', amount: parseFloat(sale.total_amount), referenceType: 'sale', referenceId: sale.id, description: desc, transaction: tx });
    // Tax Collected CREDIT
    if (parseFloat(sale.tax_amount) > 0) {
      await this.record({ accountName: 'Tax Collected (GST)', type: 'CREDIT', amount: parseFloat(sale.tax_amount), referenceType: 'sale', referenceId: sale.id, description: desc, transaction: tx });
    }
    // Discount Given DEBIT (expense)
    if (parseFloat(sale.discount_amount) > 0) {
      await this.record({ accountName: 'Discount Given', type: 'DEBIT', amount: parseFloat(sale.discount_amount), referenceType: 'sale', referenceId: sale.id, description: desc, transaction: tx });
    }
  }

  /**
   * Record accounting entries for a customer payment received.
   */
  static async recordPaymentReceived(payment, sale, tx) {
    const method = payment.method === 'CASH' ? 'Cash' : 'Bank';
    const desc = `Payment for ${sale.invoice_number}`;
    // Cash/Bank DEBIT (asset increases)
    await this.record({ accountName: method, type: 'DEBIT', amount: parseFloat(payment.amount), referenceType: 'payment', referenceId: payment.id, description: desc, transaction: tx });
    // Accounts Receivable CREDIT (receivable decreases)
    await this.record({ accountName: 'Accounts Receivable', type: 'CREDIT', amount: parseFloat(payment.amount), referenceType: 'payment', referenceId: payment.id, description: desc, transaction: tx });
  }

  /**
   * Record accounting entries for a completed purchase.
   */
  static async recordPurchase(purchase, tx) {
    const desc = `Purchase ${purchase.purchase_number}`;
    // Purchase Expense DEBIT
    await this.record({ accountName: 'Purchase Expense', type: 'DEBIT', amount: parseFloat(purchase.total_amount), referenceType: 'purchase', referenceId: purchase.id, description: desc, transaction: tx });
    // Tax Paid DEBIT (input GST asset)
    if (parseFloat(purchase.tax_amount) > 0) {
      await this.record({ accountName: 'Tax Paid (Input GST)', type: 'DEBIT', amount: parseFloat(purchase.tax_amount), referenceType: 'purchase', referenceId: purchase.id, description: desc, transaction: tx });
    }
    // Accounts Payable CREDIT (liability increases)
    await this.record({ accountName: 'Accounts Payable', type: 'CREDIT', amount: parseFloat(purchase.final_amount), referenceType: 'purchase', referenceId: purchase.id, description: desc, transaction: tx });
  }

  /**
   * Record accounting entries for a supplier payment.
   */
  static async recordSupplierPayment(payment, purchase, tx) {
    const method = payment.method === 'CASH' ? 'Cash' : 'Bank';
    const desc = `Payment for ${purchase.purchase_number}`;
    // Accounts Payable DEBIT (liability decreases)
    await this.record({ accountName: 'Accounts Payable', type: 'DEBIT', amount: parseFloat(payment.amount), referenceType: 'supplier_payment', referenceId: payment.id, description: desc, transaction: tx });
    // Cash/Bank CREDIT (asset decreases)
    await this.record({ accountName: method, type: 'CREDIT', amount: parseFloat(payment.amount), referenceType: 'supplier_payment', referenceId: payment.id, description: desc, transaction: tx });
  }

  /**
   * Get trial balance — all accounts with running balances.
   */
  static async getTrialBalance() {
    const accounts = await Account.findAll({ order: [['type', 'ASC'], ['name', 'ASC']] });
    return accounts.map((a) => a.toJSON());
  }

  /**
   * Get transactions for an account with optional date filter.
   */
  static async getAccountTransactions(accountId, { from, to, limit = 50, offset = 0 } = {}) {
    const { Op } = require('sequelize');
    const where = { account_id: accountId };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }
    return Transaction.findAndCountAll({
      where,
      include: [{ association: 'account', attributes: ['name', 'type'] }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
  }
}

module.exports = AccountingService;
