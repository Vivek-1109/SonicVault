import api from './api';
import type { Playlist } from '../types';

export async function getPlaylists(): Promise<Playlist[]> {
  const { data } = await api.get<Playlist[]>('/api/playlists');
  return data;
}

export async function getPlaylist(id: string): Promise<Playlist> {
  const { data } = await api.get<Playlist>(`/api/playlists/${id}`);
  return data;
}

export async function createPlaylist(name: string, description?: string): Promise<Playlist> {
  const { data } = await api.post<Playlist>('/api/playlists', { name, description });
  return data;
}

export async function updatePlaylist(
  id: string,
  updates: { name?: string; description?: string }
): Promise<Playlist> {
  const { data } = await api.put<Playlist>(`/api/playlists/${id}`, updates);
  return data;
}

export async function deletePlaylist(id: string): Promise<void> {
  await api.delete(`/api/playlists/${id}`);
}

export async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
  await api.post(`/api/playlists/${playlistId}/songs`, { songId });
}

export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
  await api.delete(`/api/playlists/${playlistId}/songs/${songId}`);
}

export async function reorderPlaylistSongs(playlistId: string, songIds: string[]): Promise<void> {
  await api.put(`/api/playlists/${playlistId}/songs/reorder`, { songIds });
}
