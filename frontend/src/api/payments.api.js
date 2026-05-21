import api from './axios';

export const getPaymentsApi        = (params) => api.get('/payments', { params });
export const getPaymentsSummaryApi = (params) => api.get('/payments/summary', { params });
