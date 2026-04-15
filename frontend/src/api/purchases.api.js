import api from './axios';

// Suppliers
export const getSuppliersApi = (params) => api.get('/suppliers', { params });
export const searchSuppliersApi = (q) => api.get('/suppliers/search', { params: { q } });
export const getSupplierApi = (id) => api.get(`/suppliers/${id}`);
export const createSupplierApi = (data) => api.post('/suppliers', data);
export const updateSupplierApi = (id, data) => api.put(`/suppliers/${id}`, data);

// Purchases
export const getPurchasesApi = (params) => api.get('/purchases', { params });
export const getPurchaseApi = (id) => api.get(`/purchases/${id}`);
export const createPurchaseApi = (data) => api.post('/purchases', data);
export const getPurchaseSummaryApi = () => api.get('/purchases/summary');

// Supplier Payments
export const addSupplierPaymentApi = (purchaseId, data) => api.post(`/purchases/${purchaseId}/payments`, data);
export const getPurchasePaymentsApi = (purchaseId) => api.get(`/purchases/${purchaseId}/payments`);
