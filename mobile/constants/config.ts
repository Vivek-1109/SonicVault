import { Platform } from 'react-native';

// Use localhost for Android emulator, actual IP for physical devices
const DEV_API_URL = Platform.select({
  android: 'http://192.168.1.13:3000', // Physical device or emulator
  ios: 'http://192.168.1.13:3000',
  default: 'http://192.168.1.13:3000',
});

export const config = {
  // If you deploy your backend to Railway/Render, replace DEV_API_URL with your 'https://...' URL.
  // Using DEV_API_URL here allows production APKs to connect to your local backend over WiFi.
  API_BASE_URL: DEV_API_URL,
  SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_RECENT_SEARCHES: 20,
  SIGNED_URL_BUFFER_MS: 30 * 1000, // Request new URL 30s before expiry
  MAX_RECENTLY_PLAYED: 50,
  DOWNLOAD_CHUNK_SIZE: 1024 * 1024, // 1MB
} as const;
