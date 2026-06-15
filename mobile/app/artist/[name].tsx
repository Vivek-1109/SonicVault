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
import type { Song } from '../../types';

export default function ArtistScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
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

  const artistSongs = useMemo(() => {
    if (!syncData?.songs) return [];
    return syncData.songs
      .filter((s: Song) => s.artist === name)
      .sort((a: Song, b: Song) => a.title.localeCompare(b.title));
  }, [syncData, name]);

  const artworkUrl = artistSongs[0]?.artworkUrl;

  function renderSong({ item }: { item: Song }) {
    return (
      <TouchableOpacity 
        style={styles.songRow}
        onPress={() => playSong(item, artistSongs)}
      >
        <View style={styles.artworkSmall}>
          {item.artworkUrl ? (
            <Image source={{ uri: getImageUrl(item.artworkUrl, item.id) || undefined }} style={styles.artworkImg} contentFit="cover" />
          ) : (
            <View style={styles.placeholderSmall}>
              <Text style={{color: colors.textTertiary}}>♫</Text>
            </View>
          )}
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{item.album || 'Single'}</Text>
        </View>
        <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity style={[styles.backBtn, { top: Math.max(40, insets.top + 10) }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <FlatList
        data={artistSongs}
        keyExtractor={(item) => item.id}
        renderItem={renderSong}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={styles.artworkContainer}>
              {artworkUrl ? (
                <Image source={{ uri: getImageUrl(artworkUrl, artistSongs[0]?.id) || undefined }} style={styles.artwork} contentFit="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="person-outline" size={60} color={colors.textTertiary} />
                </View>
              )}
            </View>
            <Text style={styles.artistName}>{name}</Text>
            <Text style={styles.stats}>{artistSongs.length} songs</Text>
            
            <View style={styles.controls}>
              <TouchableOpacity style={styles.playButton} onPress={() => artistSongs.length > 0 && playSong(artistSongs[0], artistSongs)}>
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
  artworkContainer: { width: 160, height: 160, borderRadius: 80, overflow: 'hidden', marginBottom: 20 },
  artwork: { width: '100%', height: '100%' },
  placeholder: { width: '100%', height: '100%', backgroundColor: colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  artistName: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 8 },
  stats: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  controls: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  playButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  songRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, gap: 12 },
  artworkSmall: { width: 48, height: 48, borderRadius: 6, overflow: 'hidden' },
  artworkImg: { width: '100%', height: '100%' },
  placeholderSmall: { width: '100%', height: '100%', backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  songInfo: { flex: 1, gap: 2 },
  songTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
  songArtist: { fontSize: 14, color: colors.textTertiary },
  duration: { fontSize: 13, color: colors.textTertiary, fontVariant: ['tabular-nums'] },
});
