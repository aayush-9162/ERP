import api from './axios';

export const getSalesReportApi = (params) => api.get('/reports/sales', { params });
export const getTopProductsApi = (params) => api.get('/reports/sales/top-products', { params });
export const getPurchaseReportApi = (params) => api.get('/reports/purchases', { params });
export const getSupplierReportApi = (params) => api.get('/reports/purchases/suppliers', { params });
export const getInventoryValuationApi = () => api.get('/reports/inventory');
export const getProfitLossApi = (params) => api.get('/reports/profit-loss', { params });
export const getCustomerReportApi = (params) => api.get('/reports/customers', { params });
export const getCustomerLedgerApi = (id) => api.get(`/reports/customers/${id}/ledger`);

// Accounting
export const getAccountsApi = () => api.get('/accounting/accounts');
export const getAccountTransactionsApi = (id, params) => api.get(`/accounting/accounts/${id}/transactions`, { params });
