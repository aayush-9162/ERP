import api from './axios';

export const getCompanyApi = () => api.get('/company');
export const updateCompanyApi = (data) => api.put('/company', data);
