import api from './axios';

export const getUsersApi = (params) => api.get('/users', { params });
export const getUserApi = (id) => api.get(`/users/${id}`);
export const createUserApi = (data) => api.post('/users', data);
export const updateUserApi = (id, data) => api.put(`/users/${id}`, data);
export const deleteUserApi = (id) => api.delete(`/users/${id}`);
