import api from './axios';

export const loginApi = (data) => api.post('/auth/login', data);
export const registerApi = (data) => api.post('/auth/register', data);
export const getProfileApi = () => api.get('/auth/me');
