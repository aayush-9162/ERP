import api from './axios';

export const getRolesApi = () => api.get('/roles');
