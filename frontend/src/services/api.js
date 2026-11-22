// services/api.js — Axios instance + all API calls

import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// 90s: the very first request after a fresh install trains the churn model (~30s); later loads use the cache.
const api = axios.create({ baseURL: BASE, timeout: 90000 })

// ── Auth Token Injection ──────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  login:    (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  me:       ()     => api.get('/api/auth/me'),
  logout:   ()     => api.post('/api/auth/logout'),
}

// ── Analytics ─────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: ()       => api.get('/api/analytics/dashboard'),
  monthly:   ()       => api.get('/api/analytics/monthly'),
  countries: ()       => api.get('/api/analytics/countries'),
  products:  (n=10)   => api.get(`/api/analytics/products?n=${n}`),
  forecast:  ()       => api.get('/api/analytics/forecast'),
  heatmap:   ()       => api.get('/api/analytics/heatmap'),
}

// ── Customer decisions (segments, churn, retention what-if) ───
export const decisionsAPI = {
  segments:      ()  => api.get('/api/decisions/segments'),
  churn:         ()  => api.get('/api/decisions/churn'),
  atRisk:        (limit=25) => api.get(`/api/decisions/at-risk?limit=${limit}`),
  retentionPlan: (p) => api.get('/api/decisions/retention-plan', { params: p }),
}

// ── Datasets ──────────────────────────────────────────────────
export const datasetsAPI = {
  list:    ()          => api.get('/api/datasets/'),
  upload:  (formData)  => api.post('/api/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  preview: (id, rows=20) => api.get(`/api/datasets/${id}/preview?rows=${rows}`),
  delete:  (id)        => api.delete(`/api/datasets/${id}`),
  sample:  ()          => api.get('/api/datasets/sample/download'),
}

// ── ML ────────────────────────────────────────────────────────
export const mlAPI = {
  train:    (data)  => api.post('/api/ml/train', data),
  results:  (id)    => api.get(`/api/ml/results/${id}`),
  history:  ()      => api.get('/api/ml/history'),
  compare:  ()      => api.get('/api/ml/compare'),
  predict:  (data)  => api.post('/api/ml/predict', data),
  compareRun: (data) => api.post('/api/ml/compare-run', data, { timeout: 120000 }),
}

// ── Reports ───────────────────────────────────────────────────
export const reportsAPI = {
  list:     ()      => api.get('/api/reports/'),
  generate: (data)  => api.post('/api/reports/generate', data),
  download: (id)    => `${BASE}/api/reports/${id}/download`,
  downloadBlob: (id) => api.get(`/api/reports/${id}/download`, { responseType: 'blob' }),
  delete:   (id)    => api.delete(`/api/reports/${id}`),
}

// ── Admin ─────────────────────────────────────────────────────
export const adminAPI = {
  stats:        ()       => api.get('/api/admin/stats'),
  users:        ()       => api.get('/api/admin/users'),
  updateUser:   (id, d)  => api.put(`/api/admin/users/${id}`, d),
  deleteUser:   (id)     => api.delete(`/api/admin/users/${id}`),
  datasets:     ()       => api.get('/api/admin/datasets'),
  logs:         (limit)  => api.get(`/api/admin/logs?limit=${limit || 50}`),
  modelPerf:    ()       => api.get('/api/admin/model-performance'),
}

// ── Insights ──────────────────────────────────────────────────
export const insightsAPI = {
  list: ()      => api.get('/api/insights/'),
  chat: (msg)   => api.post('/api/insights/chat', { message: msg }),
}

export default api
