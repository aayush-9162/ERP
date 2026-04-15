import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token + company ID to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach active company ID for data isolation
  const companyId = localStorage.getItem('activeCompanyId');
  if (companyId) {
    config.headers['x-company-id'] = companyId;
  }

  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('activeCompanyId');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
