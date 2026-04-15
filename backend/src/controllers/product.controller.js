const { Op } = require('sequelize');
const { Product, Category, Brand, Inventory } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

// Auto-generate SKU: CAT-TIMESTAMP-RANDOM
function generateSku(prefix = 'PRD') {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

// GET /api/products
async function getProducts(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    const { status, category_id, brand_id, search } = req.query;

    const where = { company_id: req.companyId };
    if (status) where.status = status;
    if (category_id) where.category_id = category_id;
    if (brand_id) where.brand_id = brand_id;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { barcode: { [Op.like]: `%${search}%` } },
      ];
    }

    const result = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Brand, as: 'brand', attributes: ['id', 'name'] },
        { model: Inventory, as: 'inventory', attributes: ['stock_quantity', 'warehouse_id'] },
      ],
      distinct: true, // Prevent over-counting from one-to-many JOIN with inventory
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    // Flatten stock total into each product row
    const rows = result.rows.map((p) => {
      const json = p.toJSON();
      json.total_stock = json.inventory.reduce((sum, inv) => sum + inv.stock_quantity, 0);
      return json;
    });

    ApiResponse.paginated(res, { rows, count: result.count, page, limit });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/:id
async function getProduct(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, as: 'category' },
        { model: Brand, as: 'brand' },
        { model: Inventory, as: 'inventory' },
      ],
    });
    if (!product) throw ApiError.notFound('Product not found');

    const json = product.toJSON();
    json.total_stock = json.inventory.reduce((sum, inv) => sum + inv.stock_quantity, 0);

    ApiResponse.success(res, { product: json });
  } catch (error) {
    next(error);
  }
}

// POST /api/products
async function createProduct(req, res, next) {
  const { sequelize } = require('../models');
  const transaction = await sequelize.transaction();

  try {
    const {
      name, sku, barcode, category_id, brand_id,
      purchase_price, selling_price, tax_rate, unit, min_stock_alert,
    } = req.body;

    const finalSku = sku || generateSku();

    // Validate unique SKU (DB constraint is the real guard; this gives a nicer error)
    const existing = await Product.findOne({ where: { sku: finalSku }, transaction });
    if (existing) throw ApiError.conflict(`SKU "${finalSku}" already exists`);

    // Validate foreign keys if provided
    if (category_id) {
      const cat = await Category.findByPk(category_id, { transaction });
      if (!cat) throw ApiError.badRequest('Invalid category');
    }
    if (brand_id) {
      const br = await Brand.findByPk(brand_id, { transaction });
      if (!br) throw ApiError.badRequest('Invalid brand');
    }

    const product = await Product.create({
      name, sku: finalSku, barcode, category_id, brand_id,
      purchase_price, selling_price, tax_rate, unit, min_stock_alert,
    }, { transaction });

    // Initialize stock at 0 — atomic with product creation
    await Inventory.create({ product_id: product.id, warehouse_id: null, stock_quantity: 0 }, { transaction });

    await transaction.commit();

    const created = await Product.findByPk(product.id, {
      include: [
        { model: Category, as: 'category' },
        { model: Brand, as: 'brand' },
        { model: Inventory, as: 'inventory' },
      ],
    });

    ApiResponse.created(res, { product: created });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
}

// PUT /api/products/:id
async function updateProduct(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');

    const allowed = [
      'name', 'sku', 'barcode', 'category_id', 'brand_id',
      'purchase_price', 'selling_price', 'tax_rate', 'unit', 'min_stock_alert', 'status',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If SKU is changing, check uniqueness
    if (updates.sku && updates.sku !== product.sku) {
      const dup = await Product.findOne({ where: { sku: updates.sku } });
      if (dup) throw ApiError.conflict(`SKU "${updates.sku}" already exists`);
    }

    await product.update(updates);

    const updated = await Product.findByPk(product.id, {
      include: [
        { model: Category, as: 'category' },
        { model: Brand, as: 'brand' },
        { model: Inventory, as: 'inventory' },
      ],
    });

    ApiResponse.success(res, { product: updated }, 'Product updated');
  } catch (error) {
    next(error);
  }
}

// DELETE /api/products/:id (soft-delete)
async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    await product.update({ status: 'inactive' });
    ApiResponse.success(res, null, 'Product deactivated');
  } catch (error) {
    next(error);
  }
}

// GET /api/products/scan/:barcode — lookup by barcode (for POS scanner)
// Optimized for speed: lean query with only essential fields for cart addition.
async function scanBarcode(req, res, next) {
  try {
    const barcode = req.params.barcode;

    // Input validation — reject obviously invalid barcodes
    if (!barcode || barcode.length < 4 || barcode.length > 100) {
      throw ApiError.badRequest('Invalid barcode format');
    }

    // Use raw SQL for maximum speed — single indexed lookup
    const { sequelize } = require('../models');
    const [rows] = await sequelize.query(`
      SELECT p.id, p.name, p.sku, p.barcode, p.selling_price, p.purchase_price,
             p.tax_rate, p.unit, p.hsn_code, p.status,
             c.id AS category_id, c.name AS category_name,
             b.id AS brand_id, b.name AS brand_name,
             COALESCE(SUM(i.stock_quantity), 0) AS total_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.barcode = :barcode AND p.status = 'active'
      GROUP BY p.id, p.name, p.sku, p.barcode, p.selling_price, p.purchase_price,
               p.tax_rate, p.unit, p.hsn_code, p.status, c.id, c.name, b.id, b.name
    `, { replacements: { barcode } });

    if (rows.length === 0) throw ApiError.notFound('Product not found for this barcode');

    const p = rows[0];
    ApiResponse.success(res, {
      product: {
        id: p.id, name: p.name, sku: p.sku, barcode: p.barcode,
        selling_price: p.selling_price, purchase_price: p.purchase_price,
        tax_rate: p.tax_rate, unit: p.unit, hsn_code: p.hsn_code,
        category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
        brand: p.brand_id ? { id: p.brand_id, name: p.brand_name } : null,
        total_stock: parseInt(p.total_stock, 10),
      },
    });
  } catch (error) { next(error); }
}

/**
 * Generate EAN-13 barcode for a product.
 * Format: 200 (in-store prefix) + 9-digit product ID + check digit.
 * Check digit algorithm: standard EAN-13 (ISO/IEC 15420).
 */
function computeEAN13CheckDigit(first12) {
  const digits = first12.split('').map(Number);
  // EAN-13: positions 1,3,5,7,9,11 weighted x1; positions 2,4,6,8,10,12 weighted x3
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

async function generateBarcode(req, res, next) {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw ApiError.notFound('Product not found');
    if (product.barcode) throw ApiError.badRequest('Product already has a barcode');

    const base = '200' + String(product.id).padStart(9, '0');
    const checkDigit = computeEAN13CheckDigit(base);
    const barcode = base + checkDigit;

    // Verify uniqueness before saving (another product could have been manually assigned this)
    const existing = await Product.findOne({ where: { barcode } });
    if (existing) throw ApiError.conflict(`Barcode ${barcode} already assigned to product ${existing.id}`);

    await product.update({ barcode });
    ApiResponse.success(res, { barcode }, 'Barcode generated');
  } catch (error) { next(error); }
}

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, scanBarcode, generateBarcode };
