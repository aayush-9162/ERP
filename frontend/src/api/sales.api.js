import api from './axios';

// Customers
export const getCustomersApi = (params) => api.get('/customers', { params });
export const searchCustomersApi = (q) => api.get('/customers/search', { params: { q } });
export const getCustomerApi = (id) => api.get(`/customers/${id}`);
export const createCustomerApi = (data) => api.post('/customers', data);
export const updateCustomerApi = (id, data) => api.put(`/customers/${id}`, data);

// Sales
export const getSalesApi = (params) => api.get('/sales', { params });
export const getSaleApi = (id) => api.get(`/sales/${id}`);
export const createSaleApi = (data) => api.post('/sales', data);
export const getSalesSummaryApi = () => api.get('/sales/summary');

// Payments
export const addPaymentApi = (saleId, data) => api.post(`/sales/${saleId}/payments`, data);
export const getSalePaymentsApi = (saleId) => api.get(`/sales/${saleId}/payments`);
