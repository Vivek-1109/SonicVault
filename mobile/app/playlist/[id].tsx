import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { usePlayerStore } from '../../stores/playerStore';
import { colors } from '../../constants/colors';
import { formatDuration } from '../../utils/formatTime';
import { getImageUrl } from '../../utils/getImageUrl';
import type { Playlist, Song } from '../../types';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayerStore();

  const { data: syncData } = useQuery({
    queryKey: ['sync'],
    queryFn: async () => {
      const res = await api.get('/api/sync');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const playlist = useMemo(() => {
    return syncData?.playlists?.find((p: Playlist) => p.id === id);
  }, [syncData, id]);

  const playlistSongs = useMemo(() => {
    if (!playlist?.songs || !syncData?.songs) return [];
    
    // Map playlist song relations to actual Song objects
    const songsMap = new Map(syncData.songs.map((s: Song) => [s.id, s]));
    
    const songsList = playlist.songs;
    return [...songsList]
      .sort((a: any, b: any) => a.position - b.position)
      .map((ps: any) => songsMap.get(ps.songId))
      .filter((s): s is Song => s !== undefined);
  }, [playlist, syncData]);

  const artworkUrl = playlist?.coverArtR2Key ? getImageUrl(playlist.coverArtR2Key) : null;

  function renderSong({ item, index }: { item: Song, index: number }) {
    return (
      <TouchableOpacity 
        style={styles.songRow}
        onPress={() => playSong(item, playlistSongs)}
      >
        <Text style={styles.trackNumber}>{index + 1}</Text>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{item.artist}</Text>
        </View>
        <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
      </TouchableOpacity>
    );
  }

  if (!playlist) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <FlatList
        data={playlistSongs}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderSong}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={styles.artworkContainer}>
              {artworkUrl ? (
                <Image source={{ uri: artworkUrl }} style={styles.artwork} contentFit="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="musical-notes-outline" size={60} color={colors.textTertiary} />
                </View>
              )}
            </View>
            <Text style={styles.playlistName}>{playlist.name}</Text>
            {playlist.description && (
              <Text style={styles.description}>{playlist.description}</Text>
            )}
            <Text style={styles.stats}>
              {playlistSongs.length} songs · {formatDuration(playlist.totalDuration)}
            </Text>
            
            <View style={styles.controls}>
              <TouchableOpacity style={styles.playButton} onPress={() => playlistSongs.length > 0 && playSong(playlistSongs[0], playlistSongs)}>
                <Ionicons name="play" size={24} color={colors.background} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { padding: 16, position: 'absolute', top: 40, left: 0, zIndex: 10 },
  header: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 24 },
  artworkContainer: { width: 240, height: 240, borderRadius: 8, overflow: 'hidden', marginBottom: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  artwork: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  playlistName: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  description: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  stats: { fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginBottom: 24 },
  controls: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  playButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  trackNumber: { width: 30, fontSize: 14, color: colors.textTertiary, textAlign: 'center' },
  songInfo: { flex: 1, marginLeft: 12, gap: 2 },
  songTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  songArtist: { fontSize: 14, color: colors.textTertiary },
  duration: { fontSize: 13, color: colors.textTertiary, fontVariant: ['tabular-nums'] },
});
