import api from './axios';

export const getQuotationsApi = (params) => api.get('/quotations', { params });
export const getQuotationApi = (id) => api.get(`/quotations/${id}`);
export const createQuotationApi = (data) => api.post('/quotations', data);
export const updateQuotationStatusApi = (id, status) => api.patch(`/quotations/${id}/status`, { status });
export const convertQuotationApi = (id, data) => api.post(`/quotations/${id}/convert`, data);

// Barcode
export const scanBarcodeApi = (barcode) => api.get(`/products/scan/${barcode}`);
export const generateBarcodeApi = (id) => api.post(`/products/${id}/barcode`);

// GST
export const getGSTR1Api = (params) => api.get('/gst/gstr1', { params });
export const getGSTR3BApi = (params) => api.get('/gst/gstr3b', { params });
export const downloadGSTR1CSVUrl = (params) => `/api/gst/gstr1/csv?${new URLSearchParams(params).toString()}`;

// E-Invoice
export const generateEInvoiceApi = (saleId) => api.post(`/sales/${saleId}/e-invoice`);
