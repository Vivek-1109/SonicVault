import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlayerStore } from '../../stores/playerStore';
import { colors } from '../../constants/colors';
import { getGreeting } from '../../utils/formatTime';
import { getImageUrl } from '../../utils/getImageUrl';
import { useRouter } from 'expo-router';
import { api } from '../../services/api';
import type { Song } from '../../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { playSong } = usePlayerStore();

  const { data: syncData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['sync'],
    queryFn: async () => {
      const res = await api.get('/api/sync');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const songs: Song[] = syncData?.songs || [];
  const playlists = syncData?.playlists || [];
  const favoriteIds: string[] = syncData?.favorites || [];

  const recentSongs = [...songs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const favoriteSongs = songs.filter(s => favoriteIds.includes(s.id)).slice(0, 10);

  // Group songs by artist
  const artistMap = new Map<string, Song[]>();
  songs.forEach(song => {
    const key = song.artist || 'Unknown Artist';
    if (!artistMap.has(key)) artistMap.set(key, []);
    artistMap.get(key)!.push(song);
  });
  const topArtists = Array.from(artistMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 6);

  function handlePlaySong(song: Song, songList: Song[]) {
    playSong(song, songList);
  }

  function handlePlayAll() {
    if (songs.length > 0) {
      if (!usePlayerStore.getState().shuffleEnabled) {
        usePlayerStore.getState().toggleShuffle();
      }
      playSong(songs[0], songs);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.subtitle}>
              {songs.length} song{songs.length !== 1 ? 's' : ''} in your vault
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/admin')}>
            <Ionicons name="settings-outline" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Quick Play */}
        {songs.length > 0 && (
          <TouchableOpacity
            style={styles.quickPlayCard}
            onPress={handlePlayAll}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(29, 185, 84, 0.2)', 'rgba(29, 185, 84, 0.05)']}
              style={styles.quickPlayGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.quickPlayIcon}>
                <Text style={styles.quickPlayIconText}>▶</Text>
              </View>
              <View style={styles.quickPlayInfo}>
                <Text style={styles.quickPlayTitle}>Shuffle All</Text>
                <Text style={styles.quickPlaySubtitle}>
                  Play your entire library
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Recently Added */}
        {recentSongs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recently Added</Text>
            <View style={styles.gridRow}>
              {recentSongs.map(song => (
                <TouchableOpacity
                  key={song.id}
                  style={styles.gridCard}
                  onPress={() => handlePlaySong(song, recentSongs)}
                  activeOpacity={0.7}
                >
                  <View style={styles.gridCardArtwork}>
                    {song.artworkUrl ? (
                      <Image
                        source={{ uri: getImageUrl(song.artworkUrl, song.id) || undefined }}
                        style={styles.gridCardImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.gridCardPlaceholder}>
                        <Text style={styles.gridCardPlaceholderText}>♫</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.gridCardTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.gridCardSubtitle} numberOfLines={1}>
                    {song.artist}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Favorites */}
        {favoriteSongs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>♥ Your Favorites</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {favoriteSongs.map(song => (
                <TouchableOpacity
                  key={song.id}
                  style={styles.horizontalCard}
                  onPress={() => handlePlaySong(song, favoriteSongs)}
                  activeOpacity={0.7}
                >
                  <View style={styles.horizontalCardArtwork}>
                    {song.artworkUrl ? (
                      <Image
                        source={{ uri: getImageUrl(song.artworkUrl, song.id) || undefined }}
                        style={styles.horizontalCardImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.horizontalCardPlaceholder}>
                        <Text style={styles.horizontalCardPlaceholderText}>♫</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.horizontalCardTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.horizontalCardSubtitle} numberOfLines={1}>
                    {song.artist}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Playlists */}
        {playlists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Playlists</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {playlists.map((playlist: any) => (
                <TouchableOpacity
                  key={playlist.id}
                  style={styles.playlistCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/playlist/${playlist.id}`)}
                >
                  <View style={styles.playlistCardArtwork}>
                    {playlist.artworkUrl ? (
                      <Image
                        source={{ uri: getImageUrl(playlist.artworkUrl) || undefined }}
                        style={styles.playlistCardImage}
                        contentFit="cover"
                      />
                    ) : (
                      <LinearGradient
                        colors={['#1DB954', '#0A7E35']}
                        style={styles.playlistCardGradient}
                      >
                        <Text style={styles.playlistCardIcon}>♪</Text>
                      </LinearGradient>
                    )}
                  </View>
                  <Text style={styles.playlistCardTitle} numberOfLines={1}>
                    {playlist.name}
                  </Text>
                  <Text style={styles.playlistCardSubtitle}>
                    {playlist.songCount || 0} songs
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Top Artists */}
        {topArtists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Artists</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {topArtists.map(([artist, artistSongs]) => (
                <TouchableOpacity
                  key={artist}
                  style={styles.artistCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/artist/${encodeURIComponent(artist)}`)}
                >
                  <View style={styles.artistAvatar}>
                    <Text style={styles.artistAvatarText}>
                      {artist.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.artistName} numberOfLines={1}>
                    {artist}
                  </Text>
                  <Text style={styles.artistCount}>
                    {artistSongs.length} song{artistSongs.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {songs.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎵</Text>
            <Text style={styles.emptyTitle}>Your vault is empty</Text>
            <Text style={styles.emptySubtitle}>
              Upload songs from the admin dashboard to get started
            </Text>
          </View>
        )}

        {/* Bottom padding for mini player */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 4,
  },
  quickPlayCard: {
    marginBottom: 28,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.15)',
  },
  quickPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  quickPlayIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickPlayIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 2,
  },
  quickPlayInfo: {
    flex: 1,
  },
  quickPlayTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  quickPlaySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: CARD_WIDTH,
    marginBottom: 4,
  },
  gridCardArtwork: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridCardImage: {
    width: '100%',
    height: '100%',
  },
  gridCardPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCardPlaceholderText: {
    fontSize: 28,
    color: colors.textTertiary,
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  gridCardSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  horizontalScroll: {
    gap: 14,
    paddingRight: 20,
  },
  horizontalCard: {
    width: 140,
  },
  horizontalCardArtwork: {
    width: 140,
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  horizontalCardImage: {
    width: '100%',
    height: '100%',
  },
  horizontalCardPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  horizontalCardPlaceholderText: {
    fontSize: 32,
    color: colors.textTertiary,
  },
  horizontalCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  horizontalCardSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  playlistCard: {
    width: 150,
  },
  playlistCardArtwork: {
    width: 150,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  playlistCardImage: {
    width: '100%',
    height: '100%',
  },
  playlistCardGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistCardIcon: {
    fontSize: 36,
    color: 'rgba(255,255,255,0.7)',
  },
  playlistCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  playlistCardSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  artistCard: {
    width: 110,
    alignItems: 'center',
  },
  artistAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  artistName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  artistCount: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
