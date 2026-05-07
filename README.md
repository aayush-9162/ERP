# ERP System

Multi-tenant SaaS ERP with authentication, RBAC, multi-company support, inventory, sales (POS), purchases, quotations, customers/suppliers, accounting, and reports.

## Repository layout

```
ERP/
├── backend/         Node.js + Express + Sequelize API (port 5000)
├── frontend/        React + Vite app for tenant users (port 5173)
└── admin-panel/     React + Vite app for SaaS platform admins (port 5174)
```

## Tech stack

| Layer        | Technology                                          |
| ------------ | --------------------------------------------------- |
| Frontend     | React 18 + Vite + Tailwind CSS + React Router       |
| Admin panel  | React 18 + Vite + Tailwind CSS                      |
| Backend      | Node.js + Express                                   |
| Database     | MySQL 8 + Sequelize ORM                             |
| Auth         | JWT + bcrypt (12 rounds)                            |
| Validation   | express-validator                                   |
| Charts       | Recharts                                            |

## Setup (development)

### Prerequisites
- Node.js 18+
- MySQL 8+

### 1. Database
```sql
CREATE DATABASE erp_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend
```bash
cd backend
cp .env.example .env       # set DB_PASSWORD, JWT_SECRET, CORS_ORIGIN, PORT
npm install
npm run seed               # creates schema, seeds sample data, dumps backend/db/schema.sql
npm run dev                # starts on http://localhost:5000
```

### 3. Frontend (tenant app)
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

### 4. Admin panel (SaaS platform admin)
```bash
cd admin-panel
npm install
npm run dev                # http://localhost:5174
```

## Sample credentials (after `npm run seed`)

### SaaS platform admin → admin-panel
| Email                  | Password         |
| ---------------------- | ---------------- |
| `superadmin@erp.com`   | `SuperAdmin@123` |

Used to manage tenants, see platform-wide users, and bypass tenant scoping.

### Tenant users → frontend
| Role    | Email               | Password      |
| ------- | ------------------- | ------------- |
| Admin   | `admin@erp.local`   | `Admin@123`   |
| Manager | `manager@erp.local` | `Manager@123` |
| Staff   | `staff@erp.local`   | `Staff@123`   |

All three live under the seeded **Acme Industries Pvt. Ltd.** tenant (India / INR).

## Architecture highlights

### Multi-tenancy
Every business-data request is gated by `middleware/companyScope.js`. The frontend sends `x-company-id` in each request; the middleware:

1. Verifies the user is an active member of that company (via `user_companies` junction table).
2. Loads the tenant and rejects suspended / cancelled / expired-trial accounts.
3. Sets `req.companyId`, `req.tenantCountry`, `req.tenantCurrency`, `req.tenantPlan`.
4. Auto-injects `company_id` into request bodies so create operations belong to the active company.

Super admins (`is_super_admin = true`) bypass this entirely.

### Stock mutations
**All** stock changes go through `services/stock.service.js`:
- `StockService.addStock()` — purchases, returns
- `StockService.removeStock()` — sales
- `StockService.adjustStock()` — manual corrections
- `StockService.deductStockInTransaction()` — for use inside an outer transaction (sales/purchases)

The hot path is one atomic `UPDATE inventory SET stock_quantity = stock_quantity + :delta WHERE ... AND stock_quantity + :delta >= 0` — no negative stock possible, no race conditions, one round-trip per movement. Every mutation also writes a row to `stock_movements` for audit.

### Schema management
The canonical production DDL lives in [`backend/db/schema.sql`](backend/db/schema.sql). It is **auto-generated** — see [`backend/db/README.md`](backend/db/README.md) for the full workflow.

- Dev iteration uses Sequelize's `sync({ alter: true })` (server.js).
- After model changes, run `npm run seed` (or `npm run schema:dump`) — this regenerates `schema.sql` from the live DB.
- Custom indexes that Sequelize can't express (NULL-safe inventory unique, covering indexes for reports) live in `src/db/postSyncIndexes.js` and are applied by both server boot and the seeder.

### Forced password reset
When an admin invites a user or resets their password, `users.must_change_password` flips to `true`. On next login the frontend forces an unclosable modal until they pick a new password.

## API surface

All endpoints are under `/api`. Full route tables in `backend/src/routes/`.

| Group              | Path prefix             | Auth scope                    |
| ------------------ | ----------------------- | ----------------------------- |
| Auth               | `/auth`                 | public + token                |
| Companies (multi-co) | `/companies`          | token                         |
| Super admin        | `/super-admin`          | super-admin only              |
| Users              | `/users`                | tenant-scoped, role-gated     |
| Company profile    | `/company`              | tenant-scoped                 |
| Roles              | `/roles`                | tenant-scoped                 |
| Categories / Brands / Products | `/categories`, `/brands`, `/products` | tenant-scoped |
| Inventory          | `/inventory`            | tenant-scoped                 |
| Stock movements    | `/stock-movements`      | tenant-scoped                 |
| Customers          | `/customers`            | tenant-scoped                 |
| Sales              | `/sales`                | tenant-scoped (POS, payments, e-invoice) |
| Quotations         | `/quotations`           | tenant-scoped                 |
| Suppliers          | `/suppliers`            | tenant-scoped                 |
| Purchases          | `/purchases`            | tenant-scoped                 |
| Accounting         | `/accounting`           | admin/manager only            |
| Reports            | `/reports`              | admin/manager only (P&L, GST, customer ledger, stock valuation) |
| Tax / GST / Currency | `/tax`, `/gst`, `/currency` | tenant-scoped               |
| Settings           | `/settings`             | tenant-scoped                 |
| Health             | `/api/health`           | public                        |

### Auth endpoints

| Method | Endpoint                        | Description                            |
| ------ | ------------------------------- | -------------------------------------- |
| POST   | `/api/auth/register`            | Self-service signup (default role: staff) |
| POST   | `/api/auth/login`               | Login → returns token + user companies |
| GET    | `/api/auth/me`                  | Get current user + companies           |
| PUT    | `/api/auth/profile`             | Update own first/last name + phone     |
| POST   | `/api/auth/change-password`     | Change own password (clears `must_change_password`) |

### Multi-company / team management

| Method | Endpoint                                          | Description                       |
| ------ | ------------------------------------------------- | --------------------------------- |
| GET    | `/api/companies`                                  | List companies the user belongs to |
| POST   | `/api/companies`                                  | Create a new company (caller becomes admin) |
| PUT    | `/api/companies/:id`                              | Update company (admin only)       |
| POST   | `/api/companies/switch`                           | Switch active company             |
| GET    | `/api/companies/:id/team`                         | List company members              |
| POST   | `/api/companies/:id/invite`                       | Invite or add a user to the company |
| DELETE | `/api/companies/:id/team/:userId`                 | Remove user from company          |
| POST   | `/api/companies/:id/team/:userId/reset-password`  | Admin resets a member's password  |

## Frontend pages

### Tenant app (`frontend/`)
- **Dashboard, Company Profile, Team** (admin/manager only)
- **Inventory** — overview, products, stock adjustments
- **Sales** — POS (with USB barcode scanner support), sales list, invoice view, customers, quotations
- **Purchases** — new purchase, purchase list, purchase view, suppliers
- **Reports & Finance** — P&L, stock valuation, customer ledger, GST returns, accounts (admin/manager only)
- **Settings** — profile, change password, logout

### Admin panel (`admin-panel/`)
- Tenants list / create / detail
- Platform users
- Settings

## Deployment

### Fresh production database
```bash
mysql -u <user> -p -e "CREATE DATABASE erp_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u <user> -p erp_system < backend/db/schema.sql
```

### Backend
```bash
cd backend
npm ci --production
NODE_ENV=production npm start    # uses src/server.js
```
In production `NODE_ENV=production` disables `sync({ alter: true })` — the schema you applied is final.

### Frontend / admin panel
```bash
cd frontend && npm ci && npm run build       # → frontend/dist
cd admin-panel && npm ci && npm run build    # → admin-panel/dist
```
Serve the `dist/` folders behind nginx or any static host. Point both apps' API base URL at the backend.

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens, configurable expiry via `JWT_EXPIRES_IN`
- `helmet` for HTTP security headers
- CORS restricted to `CORS_ORIGIN`
- All inputs validated with `express-validator`
- Password stripped from JSON responses (overridden `User.toJSON`)
- Role-based gates on both frontend (route guards) and backend (`authorize` middleware)
- Multi-tenant isolation enforced at the controller layer (`req.companyId` filter)
- Tenant lifecycle gating: suspended / cancelled / trial-expired tenants are blocked at the middleware layer
- Stock mutations protected by row-level X-locks and transaction-scoped atomic UPDATE guards
- Forced password rotation flag (`must_change_password`) for admin-issued temp passwords

## Extending with a new module

1. **Model** — add `backend/src/models/Foo.js`, register associations in `models/index.js` (don't forget the `Company.hasMany(Foo)` line in the `companyModels` loop).
2. **Service** — `backend/src/services/foo.service.js`. If it touches stock, call `StockService.deductStockInTransaction()` inside your transaction.
3. **Controller** — `backend/src/controllers/foo.controller.js`. Always filter by `req.companyId` and pass `req.companyId` when creating new rows.
4. **Validator** — `backend/src/validators/foo.validator.js`.
5. **Routes** — `backend/src/routes/foo.routes.js`, register in `routes/index.js` (mounted *after* `authenticate + companyScope`).
6. **Permissions** — add to `config/constants.js` and the seeder permission list.
7. **Frontend** — add pages under `frontend/src/pages/foo/`, an api file under `frontend/src/api/`, register the route in `App.jsx`, add a sidebar entry in `Sidebar.jsx`.
8. **Schema** — run `npm run seed` (or `npm run schema:dump`) to refresh `backend/db/schema.sql` and commit it with the rest of the change.
