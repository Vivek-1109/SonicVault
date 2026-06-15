import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Share, Alert, Modal, FlatList } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { usePlayerStore } from '../stores/playerStore';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { formatDuration } from '../utils/formatTime';
import { getImageUrl } from '../utils/getImageUrl';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { api } from '../services/api';
import type { SyncResponse, Song } from '../types';

const { width } = Dimensions.get('window');
const ARTWORK_SIZE = width - 48;

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  
  const {
    currentSong,
    queue,
    currentIndex,
    isPlaying,
    isBuffering,
    positionMs,
    durationMs,
    shuffleEnabled,
    repeatMode,
    pause,
    resume,
    nextTrack,
    previousTrack,
    toggleShuffle,
    cycleRepeat,
    seekTo,
    playSong,
  } = usePlayerStore();

  const [isQueueVisible, setIsQueueVisible] = useState(false);

  const { data: syncData } = useQuery<SyncResponse>({
    queryKey: ['sync'],
    queryFn: async () => {
      const res = await api.get('/api/sync');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isFavorite = currentSong ? (syncData?.favorites || []).includes(currentSong.id) : false;

  async function toggleFavorite() {
    if (!currentSong) return;
    const songId = currentSong.id;
    const previouslyFavorited = isFavorite;

    // Optimistic update
    queryClient.setQueryData<SyncResponse>(['sync'], (old) => {
      if (!old) return old;
      const favorites = old.favorites || [];
      return {
        ...old,
        favorites: previouslyFavorited 
          ? favorites.filter(id => id !== songId)
          : [...favorites, songId],
      };
    });

    try {
      if (previouslyFavorited) {
        await api.delete(`/api/favorites/${songId}`);
      } else {
        await api.post(`/api/favorites/${songId}`);
      }
    } catch (err) {
      // Revert on error
      queryClient.setQueryData<SyncResponse>(['sync'], (old) => {
        if (!old) return old;
        const favorites = old.favorites || [];
        return {
          ...old,
          favorites: previouslyFavorited 
            ? [...favorites, songId]
            : favorites.filter(id => id !== songId),
        };
      });
      Alert.alert('Error', 'Could not update favorites.');
    }
  }

  async function handleShare() {
    if (!currentSong) return;
    try {
      await Share.share({
        message: `Listen to "${currentSong.title}" by ${currentSong.artist} on SonicVault!`,
      });
    } catch (error) {}
  }

  function handleDesktop() {
    Alert.alert('Casting', 'Casting to desktop or speakers is coming soon!');
  }

  function renderQueueItem({ item, index }: { item: Song; index: number }) {
    const isCurrent = index === currentIndex;
    return (
      <TouchableOpacity 
        style={[styles.queueItem, isCurrent && styles.queueItemActive]} 
        onPress={() => {
          playSong(item, queue, index);
          setIsQueueVisible(false);
        }}
      >
        <Text style={[styles.queueTitle, isCurrent && styles.queueTextActive]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.queueArtist, isCurrent && styles.queueTextActive]} numberOfLines={1}>{item.artist}</Text>
      </TouchableOpacity>
    );
  }

  if (!currentSong) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.noSongText}>No song playing</Text>
      </View>
    );
  }

  const translateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10]) // Only activate on vertical swipe
    .onUpdate((event) => {
      // Only allow pulling down
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100) {
        runOnJS(router.back)();
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, { paddingTop: Math.max(insets.top, 24) }, animatedStyle]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={32} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerSubtitle}>PLAYING FROM LIBRARY</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentSong.album || 'Unknown Album'}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      {/* Artwork */}
      <View style={styles.artworkContainer}>
        {currentSong.artworkUrl ? (
          <Image
            source={{ uri: getImageUrl(currentSong.artworkUrl, currentSong.id) || undefined }}
            style={styles.artwork}
            contentFit="cover"
          />
        ) : (
          <View style={styles.artworkPlaceholder}>
            <Ionicons name="musical-notes" size={80} color={colors.textTertiary} />
          </View>
        )}
      </View>

      {/* Track Info */}
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
          </View>
          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={28} 
              color={isFavorite ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Waveform Progress */}
      <View style={styles.progressContainer}>
        <WaveformVisualizer
          progress={durationMs > 0 ? positionMs / durationMs : 0}
          isPlaying={isPlaying}
          height={40}
          onSeek={(pct) => {
            if (durationMs > 0) seekTo(pct * durationMs);
          }}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(positionMs / 1000)}</Text>
          <Text style={styles.timeText}>{formatDuration(durationMs / 1000)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleShuffle}>
          <Ionicons 
            name="shuffle" 
            size={24} 
            color={shuffleEnabled ? colors.primary : colors.textTertiary} 
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={previousTrack}>
          <Ionicons name="play-skip-back" size={40} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.playButton} 
          onPress={isPlaying ? pause : resume}
        >
          {isBuffering ? (
            <View style={styles.buffering} />
          ) : (
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={40} 
              color={colors.background} 
              style={{ marginLeft: isPlaying ? 0 : 4 }} 
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={nextTrack}>
          <Ionicons name="play-skip-forward" size={40} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={cycleRepeat}>
          <Ionicons 
            name={repeatMode === 'one' ? 'repeat' : 'repeat'} 
            size={24} 
            color={repeatMode !== 'off' ? colors.primary : colors.textTertiary} 
          />
          {repeatMode === 'one' && (
            <View style={styles.repeatOneBadge}>
              <Text style={styles.repeatOneText}>1</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleDesktop}>
          <Ionicons name="desktop-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => setIsQueueVisible(true)}>
          <Ionicons name="list" size={28} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Queue Modal */}
      <Modal visible={isQueueVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsQueueVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Up Next</Text>
            <TouchableOpacity onPress={() => setIsQueueVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={queue}
            keyExtractor={(item, idx) => `${item.id}-${idx}`}
            renderItem={renderQueueItem}
            contentContainerStyle={styles.queueList}
            initialScrollIndex={Math.max(0, currentIndex - 2)}
            getItemLayout={(data, index) => ({ length: 60, offset: 60 * index, index })}
          />
        </View>
      </Modal>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitles: {
    alignItems: 'center',
    flex: 1,
  },
  headerSubtitle: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  headerTitle: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  artworkContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
    alignItems: 'center',
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  artworkPlaceholder: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: 4,
  },
  artist: {
    ...typography.h3,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  favoriteButton: {
    padding: 8,
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8, // Compensate for large hit area
  },
  timeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 24,
  },
  controlButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buffering: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.surfaceLight,
    borderTopColor: colors.background,
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 10,
    right: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.primary,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginTop: 32,
  },
  actionButton: {
    padding: 8,
  },
  noSongText: {
    ...typography.h3,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: '50%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  queueList: {
    padding: 20,
  },
  queueItem: {
    height: 60,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  queueItemActive: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0,
    marginBottom: 1,
  },
  queueTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  queueArtist: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  queueTextActive: {
    color: colors.primary,
  },
});
