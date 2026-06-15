import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SONGS_CACHE: 'sv_songs_cache',
  PLAYLISTS_CACHE: 'sv_playlists_cache',
  FAVORITES_CACHE: 'sv_favorites_cache',
  LAST_SYNC: 'sv_last_sync',
  DOWNLOADS_META: 'sv_downloads_meta',
  RECENT_SEARCHES: 'sv_recent_searches',
  PLAYER_PREFS: 'sv_player_prefs',
  BIOMETRICS_ENABLED: 'sv_biometrics_enabled',
  DEVICE_ID: 'sv_device_id',
} as const;

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error('Storage setItem failed:', key);
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    console.error('Storage removeItem failed:', key);
  }
}

export { KEYS };
