import * as SecureStore from 'expo-secure-store';
import { api, setAccessTokenCache } from './api';
import type { LoginResponse } from '../types';

export async function login(
  email: string,
  password: string,
  deviceName: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', {
    email,
    password,
    deviceName,
  });

  // Store tokens securely
  await SecureStore.setItemAsync('sv_access_token', data.accessToken);
  await SecureStore.setItemAsync('sv_refresh_token', data.refreshToken);
  await SecureStore.setItemAsync('sv_device_id', data.deviceId);

  // Update in-memory cache
  setAccessTokenCache(data.accessToken);

  return data;
}

export async function refreshTokens(): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = await SecureStore.getItemAsync('sv_refresh_token');
  const deviceId = await SecureStore.getItemAsync('sv_device_id');

  if (!refreshToken || !deviceId) {
    throw new Error('No refresh token or device ID available');
  }

  // Use a plain axios call to avoid the interceptor loop
  const { default: axios } = await import('axios');
  const { config } = await import('../constants/config');

  const { data } = await axios.post(`${config.API_BASE_URL}/api/auth/refresh`, {
    refreshToken,
    deviceId,
  });

  await SecureStore.setItemAsync('sv_access_token', data.accessToken);
  await SecureStore.setItemAsync('sv_refresh_token', data.refreshToken);
  setAccessTokenCache(data.accessToken);

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

export async function logout(): Promise<void> {
  try {
    const deviceId = await SecureStore.getItemAsync('sv_device_id');
    if (deviceId) {
      await api.post('/api/auth/logout', { deviceId });
    }
  } catch {
    // Logout API call is best-effort; clear local state regardless
  }

  setAccessTokenCache(null);
  await SecureStore.deleteItemAsync('sv_access_token').catch(() => {});
  await SecureStore.deleteItemAsync('sv_refresh_token').catch(() => {});
  await SecureStore.deleteItemAsync('sv_device_id').catch(() => {});
}

export async function hasStoredCredentials(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync('sv_refresh_token');
  return refreshToken !== null;
}
