import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDownloadStore } from '../../stores/downloadStore';
import { usePlayerStore } from '../../stores/playerStore';
import { DownloadService } from '../../services/downloadService';
import { colors } from '../../constants/colors';
import { formatDuration, formatFileSize } from '../../utils/formatTime';
import { getImageUrl } from '../../utils/getImageUrl';
import type { DownloadInfo, Song } from '../../types';

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const { downloads, getTotalSize } = useDownloadStore();
  const { playSong } = usePlayerStore();

  const downloadedSongs = Object.values(downloads).filter(d => d.status === 'completed');
  const downloadingSongs = Object.values(downloads).filter(d => d.status === 'downloading');

  function handlePlayDownloaded(download: DownloadInfo) {
    const downloadedList: Song[] = downloadedSongs.map(d => ({
      id: d.songId,
      title: d.songTitle,
      artist: d.songArtist,
      album: null,
      genre: null,
      duration: d.duration || 0,
      artworkUrl: d.artworkUrl || null,
      r2ObjectKey: '',
      fileSize: d.fileSize,
      checksum: null,
      needsReview: 0,
      trackNumber: null,
      createdAt: '',
      updatedAt: '',
      localUri: d.localUri || undefined,
    }));
    const target = downloadedList.find(s => s.id === download.songId);
    if (target) {
      playSong(target, downloadedList);
    }
  }

  function confirmRemoveAll() {
    Alert.alert(
      'Remove All Downloads',
      'Delete all downloaded songs from this device? Your library will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: () => DownloadService.clearAll(),
        },
      ]
    );
  }

  function renderDownloadItem({ item }: { item: DownloadInfo }) {
    const isDownloading = item.status === 'downloading';

    return (
      <TouchableOpacity
        style={styles.downloadRow}
        onPress={() => item.status === 'completed' && handlePlayDownloaded(item)}
        activeOpacity={0.6}
        disabled={isDownloading}
      >
        <View style={styles.downloadIcon}>
          {isDownloading ? (
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>
                {Math.round((item.progress || 0) * 100)}%
              </Text>
            </View>
          ) : item.artworkUrl ? (
            <Image
              source={{ uri: getImageUrl(item.artworkUrl, item.songId) || undefined }}
              style={styles.artworkImage}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="musical-note" size={20} color={colors.primary} />
          )}
        </View>
        <View style={styles.downloadInfo}>
          <Text style={styles.downloadTitle} numberOfLines={1}>{item.songTitle}</Text>
          <Text style={styles.downloadArtist} numberOfLines={1}>
            {item.songArtist} · {formatFileSize(item.fileSize)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => DownloadService.removeSong(item.songId)}
          style={styles.removeBtn}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  const allItems = [...downloadingSongs, ...downloadedSongs];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Downloads</Text>
          <Text style={styles.headerSubtitle}>
            {downloadedSongs.length} song{downloadedSongs.length !== 1 ? 's' : ''} · {formatFileSize(getTotalSize())}
          </Text>
        </View>
        {downloadedSongs.length > 0 && (
          <TouchableOpacity onPress={confirmRemoveAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {allItems.length > 0 ? (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.songId}
          renderItem={renderDownloadItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-download-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No downloads</Text>
          <Text style={styles.emptySubtitle}>
            Download songs for offline listening
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 4,
  },
  clearBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  downloadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  downloadIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.primaryGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  progressCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  downloadInfo: {
    flex: 1,
    gap: 2,
  },
  downloadTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  downloadArtist: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  removeBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});
