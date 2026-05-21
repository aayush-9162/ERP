import api from './axios';

export const getDayClosingSummaryApi = (date) => api.get('/day-closing/summary', { params: { date } });
export const listDayClosingsApi      = (params) => api.get('/day-closing', { params });
export const createDayClosingApi     = (data) => api.post('/day-closing', data);
