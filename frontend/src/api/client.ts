import axios from 'axios';
import { Alert, Platform } from 'react-native';
import { storage } from '@/src/utils/storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.velalife.tr';

const api = axios.create({
  baseURL: `${EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, '')}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    const token = await storage.secureGet('auth_token', null);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 — Token expired or invalid
    if (error.response?.status === 401) {
      storage.secureRemove('auth_token');
      storage.removeItem('user');
    }

    // Handle network errors and timeouts with user-friendly alerts
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        // Timeout
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Bağlantı Zaman Aşımı',
            'Sunucuya bağlanırken zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.',
          );
        }
      } else if (error.message === 'Network Error' || !error.message) {
        // Network disconnected
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Bağlantı Hatası',
            'Sunucuya erişilemiyor. Lütfen internet bağlantınızı kontrol edin.',
          );
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
