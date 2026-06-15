import api from './api';
import { getItem, setItem, KEYS } from '../utils/storage';
import type { Song, Playlist, SyncResponse } from '../types';

interface CachedData {
  songs: Song[];
  playlists: Playlist[];
  favorites: string[];
}

export async function loadFromCache(): Promise<CachedData> {
  const [songs, playlists, favorites] = await Promise.all([
    getItem<Song[]>(KEYS.SONGS_CACHE),
    getItem<Playlist[]>(KEYS.PLAYLISTS_CACHE),
    getItem<string[]>(KEYS.FAVORITES_CACHE),
  ]);

  return {
    songs: songs ?? [],
    playlists: playlists ?? [],
    favorites: favorites ?? [],
  };
}

export async function sync(): Promise<CachedData> {
  const lastSync = await getLastSyncTimestamp();
  const params = lastSync ? { since: lastSync } : {};

  const { data } = await api.get<SyncResponse>('/api/sync', { params });

  // Load current cache
  const cached = await loadFromCache();

  // Merge songs: update existing, add new, remove deleted
  const deletedSongIds = new Set(data.deletedSongIds ?? []);

  const updatedSongsMap = new Map<string, Song>();
  for (const song of cached.songs) {
    if (!deletedSongIds.has(song.id)) {
      updatedSongsMap.set(song.id, song);
    }
  }
  for (const song of data.songs) {
    updatedSongsMap.set(song.id, song);
  }

  // Merge playlists: update existing, add new, remove deleted
  const deletedPlaylistIds = new Set(data.deletedPlaylistIds ?? []);

  const updatedPlaylistsMap = new Map<string, Playlist>();
  for (const playlist of cached.playlists) {
    if (!deletedPlaylistIds.has(playlist.id)) {
      updatedPlaylistsMap.set(playlist.id, playlist);
    }
  }
  for (const playlist of data.playlists) {
    updatedPlaylistsMap.set(playlist.id, playlist);
  }

  // Build merged result
  const merged: CachedData = {
    songs: Array.from(updatedSongsMap.values()),
    playlists: Array.from(updatedPlaylistsMap.values()),
    favorites: data.favorites, // Favorites are always returned in full
  };

  // Persist merged data
  await saveToCache(merged);
  await setLastSyncTimestamp(data.serverTimestamp);

  return merged;
}

export async function saveToCache(data: CachedData): Promise<void> {
  await Promise.all([
    setItem(KEYS.SONGS_CACHE, data.songs),
    setItem(KEYS.PLAYLISTS_CACHE, data.playlists),
    setItem(KEYS.FAVORITES_CACHE, data.favorites),
  ]);
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return getItem<string>(KEYS.LAST_SYNC);
}

export async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  await setItem(KEYS.LAST_SYNC, timestamp);
}

export async function clearCache(): Promise<void> {
  await Promise.all([
    setItem(KEYS.SONGS_CACHE, []),
    setItem(KEYS.PLAYLISTS_CACHE, []),
    setItem(KEYS.FAVORITES_CACHE, []),
    setItem(KEYS.LAST_SYNC, null),
  ]);
}
