import api from './axios';

// Tax
export const calculateTaxApi = (data) => api.post('/tax/calculate', data);
export const getTaxRulesApi = (params) => api.get('/tax/rules', { params });

// Currency
export const getCurrenciesApi = () => api.get('/currency/list');
export const getExchangeRatesApi = () => api.get('/currency/rates');
export const convertCurrencyApi = (data) => api.post('/currency/convert', data);

// Country config
export const getCountryConfigApi = (code) => api.get(`/settings/country/${code}`);
export const listCountriesApi = () => api.get('/settings/countries');
