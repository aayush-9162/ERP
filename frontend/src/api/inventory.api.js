import api from './axios';

// Categories
export const getCategoriesApi = (params) => api.get('/categories', { params });
export const createCategoryApi = (data) => api.post('/categories', data);
export const updateCategoryApi = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategoryApi = (id) => api.delete(`/categories/${id}`);

// Brands
export const getBrandsApi = (params) => api.get('/brands', { params });
export const createBrandApi = (data) => api.post('/brands', data);
export const updateBrandApi = (id, data) => api.put(`/brands/${id}`, data);
export const deleteBrandApi = (id) => api.delete(`/brands/${id}`);

// Products
export const getProductsApi = (params) => api.get('/products', { params });
export const getProductApi = (id) => api.get(`/products/${id}`);
export const createProductApi = (data) => api.post('/products', data);
export const updateProductApi = (id, data) => api.put(`/products/${id}`, data);
export const deleteProductApi = (id) => api.delete(`/products/${id}`);

// Inventory
export const getInventoryApi = (params) => api.get('/inventory', { params });
export const getInventorySummaryApi = () => api.get('/inventory/summary');
export const getLowStockApi = () => api.get('/inventory/low-stock');

// Stock Movements
export const createStockMovementApi = (data) => api.post('/stock-movements', data);
export const getStockMovementsApi = (params) => api.get('/stock-movements', { params });
export const getProductStockHistoryApi = (productId) => api.get(`/stock-movements/${productId}/history`);
