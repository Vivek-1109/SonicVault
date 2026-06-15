import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { config } from '../constants/config';

// In-memory token cache to avoid async SecureStore lookups on every request
let accessTokenCache: string | null = null;
let authFailureCallback: (() => void) | null = null;

export function setAuthFailureCallback(cb: () => void) {
  authFailureCallback = cb;
}

interface QueuedRequest {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

let isRefreshing = false;
let failedQueue: QueuedRequest[] = [];

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
}

const api = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use(
  async (requestConfig: InternalAxiosRequestConfig) => {
    // Use cached token first, fall back to SecureStore
    if (!accessTokenCache) {
      accessTokenCache = await SecureStore.getItemAsync('sv_access_token');
    }
    if (accessTokenCache && requestConfig.headers) {
      requestConfig.headers.Authorization = `Bearer ${accessTokenCache}`;
    }
    return requestConfig;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the refresh endpoint itself failed
    if (originalRequest.url?.includes('/auth/refresh')) {
      await clearTokens();
      if (authFailureCallback) authFailureCallback();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync('sv_refresh_token');
      const deviceId = await SecureStore.getItemAsync('sv_device_id');

      if (!refreshToken || !deviceId) {
        throw new Error('No refresh token or device ID available');
      }

      const { data } = await axios.post(`${config.API_BASE_URL}/api/auth/refresh`, {
        refreshToken,
        deviceId,
      });

      const newAccessToken: string = data.accessToken;
      const newRefreshToken: string = data.refreshToken;

      await SecureStore.setItemAsync('sv_access_token', newAccessToken);
      await SecureStore.setItemAsync('sv_refresh_token', newRefreshToken);
      accessTokenCache = newAccessToken;

      processQueue(null, newAccessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as Error, null);
      await clearTokens();
      if (authFailureCallback) authFailureCallback();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

async function clearTokens(): Promise<void> {
  accessTokenCache = null;
  SecureStore.deleteItemAsync('sv_access_token').catch(() => {});
  SecureStore.deleteItemAsync('sv_refresh_token').catch(() => {});
  SecureStore.deleteItemAsync('sv_device_id').catch(() => {});
}

// Utility to update the in-memory cache when tokens are set externally
export function setAccessTokenCache(token: string | null): void {
  accessTokenCache = token;
}

export function getAccessTokenCache(): string | null {
  return accessTokenCache;
}

export { api, clearTokens };
export default api;
