import api from './axios';

export const getMyCompaniesApi = () => api.get('/companies');
export const createCompanyApi = (data) => api.post('/companies', data);
export const updateCompanyApi = (id, data) => api.put(`/companies/${id}`, data);
export const switchCompanyApi = (company_id) => api.post('/companies/switch', { company_id });
export const getTeamApi = (companyId) => api.get(`/companies/${companyId}/team`);
export const inviteUserApi = (companyId, data) => api.post(`/companies/${companyId}/invite`, data);
export const removeUserApi = (companyId, userId) => api.delete(`/companies/${companyId}/team/${userId}`);
