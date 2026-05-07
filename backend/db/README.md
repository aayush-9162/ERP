# Database schema

`schema.sql` is the single source of truth for the production database structure. It is **auto-generated** — never edit it by hand.

## When it gets regenerated

- **Every `npm run seed`** — the seeder runs `sync({ force: true })` + `applyPostSyncIndexes()` then dumps the resulting schema.
- **On demand**: `npm run schema:dump`

Both routes write to `backend/db/schema.sql`.

## Workflow when you change a model

1. Edit the model file under `src/models/`.
2. Run `npm run seed` (or `npm run schema:dump` if you don't want to wipe data).
3. Commit the updated `schema.sql` along with your model change.

The schema file is version-controlled so reviewers can see exactly what DDL change a model edit produces.

## Deploying to a fresh database

```bash
# 1. Create the empty database
mysql -u <user> -p -e "CREATE DATABASE erp_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Apply the schema
mysql -u <user> -p erp_system < backend/db/schema.sql

# 3. (Optional) Seed sample data
cd backend && npm run seed
```

For production deploys, **skip step 3** — just apply `schema.sql` and let the app create its own data, or import a real backup.

## Why not Sequelize migrations?

The project currently uses `sync({ alter: true })` in dev (in `server.js`) which is fast and convenient. For production hand-offs, a flat `schema.sql` is enough until the schema starts evolving across multiple deployed environments — at which point migrating to `sequelize-cli` or `umzug` migrations becomes worthwhile.

## What's in `postSyncIndexes.js`

A few indexes can't be expressed via Sequelize model definitions:

- `inventory_product_warehouse_unique` — a functional unique index on `(product_id, COALESCE(warehouse_id, 0))` so MySQL doesn't allow duplicate `NULL` warehouses (the standard unique constraint doesn't, but `<=>` does).
- `idx_sale_items_covering`, `idx_sales_report`, `idx_sales_customer`, `idx_purchases_report` — covering indexes for the heavy aggregation queries in the reports module.

Both `server.js` (on boot) and the seeder call `applyPostSyncIndexes()` so all entry points produce the same schema.
