/**
 * Custom indexes that Sequelize's `sync()` cannot express directly:
 * - functional unique index on inventory using COALESCE(warehouse_id, 0) so MySQL
 *   doesn't allow duplicate NULL warehouses
 * - covering indexes used by the heavy report queries (P&L, sales/purchase summaries)
 *
 * Both `server.js` (on boot in dev) and `seeders/index.js` (after a fresh sync)
 * call this so the schema produced by either path matches what production needs.
 */

const POST_SYNC_INDEXES = [
  // Inventory uniqueness: replace Sequelize-generated unique index with a NULL-safe one
  // The DROP is wrapped — if it doesn't exist (fresh DB), that's fine.
  { type: 'drop', sql: 'DROP INDEX `inventory_product_id_warehouse_id` ON `inventory`' },
  {
    type: 'create',
    sql: `CREATE UNIQUE INDEX inventory_product_warehouse_unique
          ON inventory (product_id, (COALESCE(warehouse_id, 0)))`,
  },
  // Report query covering indexes (avoid table lookups during aggregations)
  { type: 'create', sql: 'CREATE INDEX idx_sale_items_covering ON sale_items (sale_id, product_id, quantity, total)' },
  { type: 'create', sql: 'CREATE INDEX idx_sales_report ON sales (created_at, total_amount, tax_amount, discount_amount, final_amount, paid_amount)' },
  { type: 'create', sql: 'CREATE INDEX idx_sales_customer ON sales (customer_id, final_amount, paid_amount, created_at)' },
  { type: 'create', sql: 'CREATE INDEX idx_purchases_report ON purchases (created_at, total_amount, tax_amount, final_amount, paid_amount)' },
];

async function applyPostSyncIndexes(sequelize) {
  for (const { sql } of POST_SYNC_INDEXES) {
    // Each statement is idempotent in spirit — swallow errors so re-running is safe
    await sequelize.query(sql).catch(() => {});
  }
}

module.exports = { applyPostSyncIndexes, POST_SYNC_INDEXES };
