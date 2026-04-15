# ERP System — Phase 1 + Phase 2

Production-ready ERP with authentication, RBAC, user management, company profile, and full inventory module.

## Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | React 18 + Vite + Tailwind CSS     |
| Backend  | Node.js + Express.js               |
| Database | MySQL + Sequelize ORM              |
| Auth     | JWT + bcrypt                        |

## Folder Structure

```
ERP/
├── backend/
│   └── src/
│       ├── config/          # DB connection, constants
│       ├── controllers/     # Route handlers (MVC)
│       ├── middleware/       # auth, validation, error handling
│       ├── models/          # Sequelize models + associations
│       ├── routes/          # Express route definitions
│       ├── services/        # Business logic (StockService)
│       ├── seeders/         # Sample data seeder
│       ├── validators/      # express-validator rules
│       ├── utils/           # ApiError, ApiResponse helpers
│       └── server.js        # Entry point
├── frontend/
│   └── src/
│       ├── api/             # Axios instances + API calls
│       ├── components/      # Layout, common components
│       ├── contexts/        # AuthContext (React Context)
│       ├── pages/
│       │   ├── auth/        # Login
│       │   ├── dashboard/   # Main dashboard
│       │   ├── users/       # User management
│       │   ├── company/     # Company settings
│       │   └── inventory/   # Products, stock, adjustments
│       ├── App.jsx          # Root routing
│       └── main.jsx         # Entry point
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- MySQL 8+

### 1. Database

```sql
CREATE DATABASE erp_system;
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # Edit DB_PASSWORD and JWT_SECRET
npm install
npm run seed               # Creates tables + sample data (7 products, 3 users)
npm run dev                # Starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                # Starts on http://localhost:5173
```

### Sample Credentials (after seeding)

| Role    | Email              | Password    |
| ------- | ------------------ | ----------- |
| Admin   | admin@erp.local    | Admin@123   |
| Manager | manager@erp.local  | Manager@123 |
| Staff   | staff@erp.local    | Staff@123   |

## API Routes

### Auth

| Method | Endpoint           | Description       | Auth |
| ------ | ------------------ | ----------------- | ---- |
| POST   | /api/auth/register | Register new user | No   |
| POST   | /api/auth/login    | Login             | No   |
| GET    | /api/auth/me       | Get current user  | Yes  |

### Users

| Method | Endpoint        | Description                      | Role           |
| ------ | --------------- | -------------------------------- | -------------- |
| GET    | /api/users      | List users (paginated, search)   | Admin, Manager |
| GET    | /api/users/:id  | Get single user                  | Admin, Manager |
| POST   | /api/users      | Create user                      | Admin          |
| PUT    | /api/users/:id  | Update user                      | Admin          |
| DELETE | /api/users/:id  | Deactivate user                  | Admin          |

### Company

| Method | Endpoint     | Description            | Role       |
| ------ | ------------ | ---------------------- | ---------- |
| GET    | /api/company | Get company profile    | Any authed |
| PUT    | /api/company | Update company profile | Admin      |

### Roles

| Method | Endpoint   | Description | Role       |
| ------ | ---------- | ----------- | ---------- |
| GET    | /api/roles | List roles  | Any authed |

### Categories (Phase 2)

| Method | Endpoint            | Description         | Role           |
| ------ | ------------------- | ------------------- | -------------- |
| GET    | /api/categories     | List categories     | Any authed     |
| GET    | /api/categories/:id | Get single category | Any authed     |
| POST   | /api/categories     | Create category     | Admin, Manager |
| PUT    | /api/categories/:id | Update category     | Admin, Manager |
| DELETE | /api/categories/:id | Deactivate category | Admin          |

### Brands (Phase 2)

| Method | Endpoint        | Description      | Role           |
| ------ | --------------- | ---------------- | -------------- |
| GET    | /api/brands     | List brands      | Any authed     |
| GET    | /api/brands/:id | Get single brand | Any authed     |
| POST   | /api/brands     | Create brand     | Admin, Manager |
| PUT    | /api/brands/:id | Update brand     | Admin, Manager |
| DELETE | /api/brands/:id | Deactivate brand | Admin          |

### Products (Phase 2)

| Method | Endpoint          | Description                              | Role           |
| ------ | ----------------- | ---------------------------------------- | -------------- |
| GET    | /api/products     | List products (paginated, search, filter)| Any authed     |
| GET    | /api/products/:id | Get product with stock info              | Any authed     |
| POST   | /api/products     | Create product (auto-generates SKU)      | Admin, Manager |
| PUT    | /api/products/:id | Update product                           | Admin, Manager |
| DELETE | /api/products/:id | Deactivate product                       | Admin          |

### Inventory (Phase 2)

| Method | Endpoint               | Description                    | Role       |
| ------ | ---------------------- | ------------------------------ | ---------- |
| GET    | /api/inventory         | List all product stock levels  | Any authed |
| GET    | /api/inventory/summary | Dashboard stats (totals, value)| Any authed |
| GET    | /api/inventory/low-stock | Products below min_stock_alert| Any authed |
| GET    | /api/inventory/warehouses | List warehouses             | Any authed |

### Stock Movements (Phase 2)

| Method | Endpoint                              | Description                | Role           |
| ------ | ------------------------------------- | -------------------------- | -------------- |
| GET    | /api/stock-movements                  | List movements (filtered)  | Any authed     |
| GET    | /api/stock-movements/:productId/history | Product movement history | Any authed     |
| POST   | /api/stock-movements                  | Record stock IN/OUT/ADJUST | Admin, Manager |

### Health

| Method | Endpoint    | Description  | Auth |
| ------ | ----------- | ------------ | ---- |
| GET    | /api/health | Health check | No   |

## Database Schema

### Phase 1
```
roles (id, name, description)
permissions (id, name, description, module)
role_permissions (role_id, permission_id)
users (id, first_name, last_name, email, password, phone, status, role_id, last_login)
companies (id, name, gst_number, pan_number, address_line1/2, city, state, pincode, country, phone, email, website, logo_url)
```

### Phase 2 — Inventory
```
categories (id, name, description, status)
brands (id, name, status)
products (id, name, sku[unique], barcode, category_id[FK], brand_id[FK], purchase_price, selling_price, tax_rate, unit, min_stock_alert, status)
warehouses (id, name, location, status)
inventory (id, product_id[FK], warehouse_id[FK nullable], stock_quantity) — unique on (product_id, warehouse_id)
stock_movements (id, product_id[FK], warehouse_id[FK], type[IN/OUT/ADJUSTMENT], quantity, reference, notes, created_by[FK→users])
```

**Indexes**: sku (unique), product_id on inventory + stock_movements, created_at on stock_movements.

## Architecture — Stock Movement Service

All stock changes go through `StockService` (`backend/src/services/stock.service.js`):

- `StockService.addStock()` — used by purchases, returns
- `StockService.removeStock()` — used by sales
- `StockService.adjustStock()` — used by manual corrections

Business rules enforced:
- **No direct inventory updates** — all mutations via StockService
- **No negative stock** — transaction-level check with row locking
- **Full audit trail** — every change creates a stock_movements record
- **Transaction safety** — Sequelize transactions with `LOCK.UPDATE`

Future modules (Sales, Purchase) call the same service to maintain consistency.

## Extending with New Modules

To add a new ERP module (e.g., Sales):

1. **Model**: Create `backend/src/models/SaleOrder.js`, add associations in `models/index.js`
2. **Service**: Create `backend/src/services/sales.service.js` (call `StockService.removeStock()` on sale)
3. **Controller**: Create `backend/src/controllers/sales.controller.js`
4. **Validator**: Create `backend/src/validators/sales.validator.js`
5. **Routes**: Create `backend/src/routes/sales.routes.js`, register in `routes/index.js`
6. **Permissions**: Add to `config/constants.js` and seed
7. **Frontend**: Add pages under `frontend/src/pages/sales/`, API file, routes in `App.jsx`, nav in `Sidebar.jsx`

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with configurable expiry
- Helmet.js for HTTP security headers
- CORS restricted to frontend origin
- Input validation on all endpoints (express-validator)
- Password stripped from all JSON responses
- Role-based route protection (frontend + backend)
- Stock mutations protected by database transactions + row locking
