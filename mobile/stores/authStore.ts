import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as authService from '../services/authService';
import { setAccessTokenCache, setAuthFailureCallback } from '../services/api';
import { getItem, setItem, KEYS } from '../utils/storage';
import type { AuthState, AuthActions } from '../types';

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => {
  setAuthFailureCallback(() => {
    get().logout();
  });

  return {
  // State
  isAuthenticated: false,
  isLoading: true,
  biometricsEnabled: false,
  deviceId: null,
  userEmail: null,

  // Actions
  initialize: async () => {
    try {
      set({ isLoading: true });

      // Load preferences
      const biometricsEnabled = await getItem<boolean>(KEYS.BIOMETRICS_ENABLED);
      const deviceId = await SecureStore.getItemAsync('sv_device_id');

      // Check if we have a refresh token and try auto-refresh
      const hasCredentials = await authService.hasStoredCredentials();

      if (hasCredentials) {
        try {
          await authService.refreshTokens();
          set({
            isAuthenticated: true,
            isLoading: false,
            biometricsEnabled: biometricsEnabled ?? false,
            deviceId,
          });
          return;
        } catch {
          // Refresh failed — user must log in again
          set({
            isAuthenticated: false,
            isLoading: false,
            biometricsEnabled: biometricsEnabled ?? false,
            deviceId: null,
            userEmail: null,
          });
          return;
        }
      }

      set({
        isAuthenticated: false,
        isLoading: false,
        biometricsEnabled: biometricsEnabled ?? false,
        deviceId,
      });
    } catch {
      set({
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    const { Platform } = require('react-native');
    const deviceName = Platform.select({
      ios: 'SonicVault iPhone',
      android: 'SonicVault Android',
      default: 'SonicVault Web',
    });
    const result = await authService.login(email, password, deviceName);
    set({
      isAuthenticated: true,
      isLoading: false,
      deviceId: result.deviceId,
      userEmail: email,
    });
  },

  logout: async () => {
    await authService.logout();
    set({
      isAuthenticated: false,
      deviceId: null,
      userEmail: null,
    });
  },

  refreshTokens: async (): Promise<boolean> => {
    try {
      await authService.refreshTokens();
      return true;
    } catch {
      const { logout } = get();
      await logout();
      return false;
    }
  },

  setBiometrics: async (enabled: boolean) => {
    await setItem(KEYS.BIOMETRICS_ENABLED, enabled);
    set({ biometricsEnabled: enabled });
  },
};
});
