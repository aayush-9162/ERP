import api from './axios';

// Auth
export const superAdminLogin = (data) => api.post('/login', data);

// Dashboard
export const getDashboardStats = () => api.get('/dashboard');

// Options (countries, plans)
export const getOptions = () => api.get('/options');

// Tenants
export const listTenants = (params) => api.get('/tenants', { params });
export const getTenant = (id) => api.get(`/tenants/${id}`);
export const createTenant = (data) => api.post('/tenants', data);
export const updateTenant = (id, data) => api.put(`/tenants/${id}`, data);
export const suspendTenant = (id) => api.post(`/tenants/${id}/suspend`);
export const activateTenant = (id) => api.post(`/tenants/${id}/activate`);
export const deleteTenant = (id) => api.delete(`/tenants/${id}`);
export const getTenantStats = (id) => api.get(`/tenants/${id}/stats`);
export const getTenantUsers = (id) => api.get(`/tenants/${id}/users`);

// Users
export const listAllUsers = (params) => api.get('/users', { params });
export const toggleUserStatus = (userId) => api.post(`/users/${userId}/toggle-status`);
export const resetUserPassword = (userId) => api.post(`/users/${userId}/reset-password`);
