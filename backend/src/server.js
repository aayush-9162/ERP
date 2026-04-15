require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Global middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API routes ---
app.use('/api', routes);

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start ---
async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync models (use { alter: true } in dev; migrations in prod)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Models synchronized.');

    // Fix: MySQL allows duplicate NULLs in UNIQUE indexes.
    // Replace the Sequelize-generated unique index with a functional one
    // that treats NULL warehouse_id as 0 for uniqueness purposes.
    try {
      await sequelize.query('DROP INDEX `inventory_product_id_warehouse_id` ON `inventory`').catch(() => {});
      await sequelize.query(`
        CREATE UNIQUE INDEX inventory_product_warehouse_unique
        ON inventory (product_id, (COALESCE(warehouse_id, 0)))
      `).catch(() => {}); // Ignore if already exists
    } catch { /* index may already exist */ }

    // Performance indexes for report queries at scale (100K+ rows).
    // These are covering indexes so aggregation queries avoid table lookups.
    const perfIndexes = [
      // topSellingProducts: JOIN sale_items + sales, GROUP BY product_id
      'CREATE INDEX idx_sale_items_covering ON sale_items (sale_id, product_id, quantity, total)',
      // salesReport: GROUP BY DATE_FORMAT(created_at) with SUM aggregations
      'CREATE INDEX idx_sales_report ON sales (created_at, total_amount, tax_amount, discount_amount, final_amount, paid_amount)',
      // customerReport: GROUP BY customer_id with SUM
      'CREATE INDEX idx_sales_customer ON sales (customer_id, final_amount, paid_amount, created_at)',
      // purchaseReport: GROUP BY date with SUM
      'CREATE INDEX idx_purchases_report ON purchases (created_at, total_amount, tax_amount, final_amount, paid_amount)',
    ];
    for (const sql of perfIndexes) {
      await sequelize.query(sql).catch(() => {}); // Ignore if exists
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
