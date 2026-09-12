import axios from 'axios';
import { handleMockRequest } from './mockData';

const isStandalone = () => {
  // If an explicit backend URL is provided, connect to it
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return false;
  }
  // When running on static cloud hosting (e.g. Vercel, Netlify) without backend
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (
      host.includes('vercel.app') ||
      host.includes('netlify.app') ||
      host.includes('github.io') ||
      (!host.includes('localhost') && !host.includes('127.0.0.1'))
    ) {
      return true;
    }
  }
  return false;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
});

// Request interceptor to attach JWT token or divert to mock engine if standalone
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ser_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (isStandalone()) {
      config.adapter = () => handleMockRequest(config);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle authentication expiry and fallback to mock engine
api.interceptors.response.use(
  (response) => {
    // Detect Vercel SPA rewrite fallback (status 200 but HTML string payload)
    if (
      typeof response.data === 'string' &&
      (response.data.includes('<!doctype html') || response.data.includes('<html'))
    ) {
      return handleMockRequest(response.config);
    }
    return response;
  },
  async (error) => {
    // If backend is unreachable or returns 404 / 405 / 502 / network error
    if (
      !error.response ||
      error.response.status === 404 ||
      error.response.status === 405 ||
      error.response.status === 502 ||
      error.response.status === 503 ||
      error.code === 'ERR_NETWORK' ||
      error.message?.includes('Network Error')
    ) {
      return handleMockRequest(error.config);
    }

    if (error.response && error.response.status === 401) {
      // Clear token if expired or unauthorized
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        localStorage.removeItem('ser_token');
        localStorage.removeItem('ser_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  getCurrentUser: () => api.get('/api/auth/me'),
  changePassword: (data) => api.put('/api/auth/change-password', data),
};

export const dashboardApi = {
  getSummary: () => api.get('/api/dashboard/summary'),
  getAnalytics: () => api.get('/api/dashboard/analytics'),
};

export const aiApi = {
  getStatus: () => api.get('/api/ai/status'),
  analyzeImage: (formData) => api.post('/api/ai/analyze-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  analyzeVideo: (formData) => api.post('/api/ai/analyze-video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getDetections: (params) => api.get('/api/ai/detections', { params }),
  getDetection: (id) => api.get(`/api/ai/detections/${id}`),
};

export const accidentsApi = {
  getAccidents: (params) => api.get('/api/accidents', { params }),
  getAccident: (id) => api.get(`/api/accidents/${id}`),
  createAccident: (data) => api.post('/api/accidents', data),
  updateAccident: (id, data) => api.put(`/api/accidents/${id}`, data),
  deleteAccident: (id) => api.delete(`/api/accidents/${id}`),
  verifyAccident: (id, data) => api.put(`/api/accidents/${id}/verify`, data),
  updateStatus: (id, data) => api.put(`/api/accidents/${id}/status`, data),
};

export const unitsApi = {
  getUnits: (params) => api.get('/api/emergency-units', { params }),
  getUnit: (id) => api.get(`/api/emergency-units/${id}`),
  createUnit: (data) => api.post('/api/emergency-units', data),
  updateUnit: (id, data) => api.put(`/api/emergency-units/${id}`, data),
  deleteUnit: (id) => api.delete(`/api/emergency-units/${id}`),
};

export const assignmentsApi = {
  getAssignments: (params) => api.get('/api/assignments', { params }),
  createAssignment: (data) => api.post('/api/assignments', data),
  updateStatus: (id, data) => api.put(`/api/assignments/${id}/status`, data),
};

export const notificationsApi = {
  getNotifications: (params) => api.get('/api/notifications', { params }),
  markRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put('/api/notifications/read-all'),
};

export const reportsApi = {
  getAccidentsReport: (params) => api.get('/api/reports/accidents', { params }),
  getSeverityReport: (params) => api.get('/api/reports/severity', { params }),
  getResponseTimeReport: (params) => api.get('/api/reports/response-time', { params }),
  getDailyReport: (params) => api.get('/api/reports/daily', { params }),
  getExportCsvUrl: (params) => {
    const query = new URLSearchParams(params).toString();
    return `/api/reports/export-csv?${query}`;
  }
};

export const usersApi = {
  getUsers: () => api.get('/api/users'),
  updateUserRole: (id, data) => api.put(`/api/users/${id}/role`, data),
  deleteUser: (id) => api.delete(`/api/users/${id}`),
  getAuditLogs: (params) => api.get('/api/users/audit-logs', { params }),
};

export const healthApi = {
  checkHealth: () => api.get('/api/health'),
};

export default api;
