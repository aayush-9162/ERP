const { Op } = require('sequelize');
const { StockMovement, Product, User } = require('../models');
const StockService = require('../services/stock.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { STOCK_MOVEMENT_TYPES } = require('../config/constants');

// POST /api/stock-movements — create a stock movement (add/remove/adjust)
// For ADJUSTMENT type, quantity is always positive from the client.
// The type itself determines the direction:
//   IN         → adds stock
//   OUT        → removes stock (rejects if insufficient)
//   ADJUSTMENT → adds stock (use OUT to subtract, keeps API simple and consistent)
async function createMovement(req, res, next) {
  try {
    const { product_id, type, quantity, reference, notes, warehouse_id } = req.body;

    let result;
    switch (type) {
      case STOCK_MOVEMENT_TYPES.IN:
        result = await StockService.addStock({
          product_id, quantity, reference, notes, warehouse_id, user_id: req.user.id,
        });
        break;
      case STOCK_MOVEMENT_TYPES.OUT:
        result = await StockService.removeStock({
          product_id, quantity, reference, notes, warehouse_id, user_id: req.user.id,
        });
        break;
      case STOCK_MOVEMENT_TYPES.ADJUSTMENT:
        // Adjustment adds the given quantity (correction-up).
        // For correction-down, use type=OUT with reference=manual.
        result = await StockService.adjustStock({
          product_id, quantity: Math.abs(quantity), reference, notes, warehouse_id, user_id: req.user.id,
        });
        break;
      default:
        throw ApiError.badRequest('Invalid movement type');
    }

    ApiResponse.created(res, {
      movement: result.movement,
      new_stock: result.inventory.stock_quantity,
    }, 'Stock movement recorded');
  } catch (error) {
    next(error);
  }
}

// GET /api/stock-movements
async function getMovements(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { product_id, type, reference, from, to } = req.query;

    const where = { company_id: req.companyId };
    if (product_id) where.product_id = product_id;
    if (type) where.type = type;
    if (reference) where.reference = reference;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const result = await StockMovement.findAndCountAll({
      where,
      include: [
        { association: 'product', attributes: ['id', 'name', 'sku'] },
        { association: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    ApiResponse.paginated(res, { ...result, page, limit });
  } catch (error) {
    next(error);
  }
}

// GET /api/stock-movements/:productId/history
async function getProductHistory(req, res, next) {
  try {
    const movements = await StockMovement.findAll({
      where: { product_id: req.params.productId },
      include: [
        { association: 'createdBy', attributes: ['id', 'first_name', 'last_name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    ApiResponse.success(res, { movements });
  } catch (error) {
    next(error);
  }
}

module.exports = { createMovement, getMovements, getProductHistory };
