import axios from 'axios';

// In production (Render), API is on same domain
// In dev, Vite proxy handles /api → localhost:3000
const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default api;
