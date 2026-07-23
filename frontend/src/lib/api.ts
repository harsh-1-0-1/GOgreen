import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

const CART_SESSION_KEY = 'cart_session_id';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const cartSessionId = localStorage.getItem(CART_SESSION_KEY);
  if (cartSessionId) {
    config.headers['X-Cart-Session-Id'] = cartSessionId;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
      );
      const newAccess = data.access_token as string;
      const newRefresh = data.refresh_token as string;
      localStorage.setItem('access_token', newAccess);
      localStorage.setItem('refresh_token', newRefresh);
      processQueue(null, newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    } catch (err) {
      processQueue(err, null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // Use replace instead of href assignment so React isn't mid-render when
      // the page unloads, avoiding a spurious ErrorBoundary catch on the way out.
      // Also only redirect if we're not already on the home page.
      if (window.location.pathname !== '/') {
        window.location.replace('/');
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
