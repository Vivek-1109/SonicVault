import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../../stores/playerStore';
import { colors } from '../../constants/colors';
import { formatDuration, formatFileSize } from '../../utils/formatTime';
import { getImageUrl } from '../../utils/getImageUrl';
import { api } from '../../services/api';
import { adminService } from '../../services/adminService';
import { DownloadService } from '../../services/downloadService';
import {
  inferAudioMimeType,
  pickLocalAudioFiles,
  resolveLocalAudioUploadUri,
  scanLocalAudio,
} from '../../services/localAudioService';
import { useDownloadStore } from '../../stores/downloadStore';
import type { LocalAudioAsset, Song, SyncResponse } from '../../types';

type LibraryMode = 'vault' | 'local';
type UploadStatus = 'uploading' | 'done' | 'error';

function mergeUploadedSong(cache: SyncResponse | undefined, song: Song): SyncResponse | undefined {
  if (!cache) return cache;
  return {
    ...cache,
    songs: [song, ...(cache.songs || []).filter((item) => item.id !== song.id)],
  };
}

function removeCachedSong(cache: SyncResponse | undefined, songId: string): SyncResponse | undefined {
  if (!cache) return cache;

  return {
    ...cache,
    songs: (cache.songs || []).filter((song) => song.id !== songId),
    favorites: (cache.favorites || []).filter((id) => id !== songId),
    playlists: (cache.playlists || []).map((playlist: any) => {
      if (!Array.isArray(playlist.songs)) return playlist;
      const nextSongs = playlist.songs.filter((entry: any) => {
        const id = entry.songId || entry.id || entry.song?.id;
        return id !== songId;
      });
      return {
        ...playlist,
        songs: nextSongs,
        songCount: nextSongs.length,
      };
    }),
    deletedSongIds: Array.from(new Set([...(cache.deletedSongIds || []), songId])),
  };
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { playSong, removeSongFromLibrary } = usePlayerStore();
  const { isDownloaded } = useDownloadStore();

  const [mode, setMode] = useState<LibraryMode>('vault');
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [localAssets, setLocalAssets] = useState<LocalAudioAsset[]>([]);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [selectedLocalIds, setSelectedLocalIds] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({});

  const { data: syncData } = useQuery<SyncResponse>({
    queryKey: ['sync'],
    queryFn: async () => {
      const res = await api.get('/api/sync');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allSongs: Song[] = syncData?.songs || [];
  const sortedSongs = useMemo(() => {
    return [...allSongs].sort((a, b) => a.title.localeCompare(b.title));
  }, [allSongs]);

  const selectedLocalAssets = useMemo(() => {
    return localAssets.filter((asset) => selectedLocalIds.has(asset.id));
  }, [localAssets, selectedLocalIds]);

  useEffect(() => {
    if (mode === 'local' && localAssets.length === 0 && !isLoadingLocal) {
      loadLocalAudio();
    }
  }, [mode]);

  async function loadLocalAudio() {
    try {
      setIsLoadingLocal(true);
      const result = await scanLocalAudio();
      setLocalAssets(result.assets);
      setLocalMessage(result.message || (result.assets.length === 0 ? 'No local songs found' : null));
    } finally {
      setIsLoadingLocal(false);
    }
  }

  async function handlePickFiles() {
    const picked = await pickLocalAudioFiles();
    if (picked.length === 0) return;

    setLocalAssets((current) => {
      const map = new Map(current.map((asset) => [asset.id, asset]));
      picked.forEach((asset) => map.set(asset.id, asset));
      return Array.from(map.values());
    });
    setLocalMessage(null);
  }

  function toggleLocalSelection(id: string) {
    setSelectedLocalIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleUploadSelected() {
    if (selectedLocalAssets.length === 0) return;

    let failed = 0;
    for (const asset of selectedLocalAssets) {
      setUploadStatus((current) => ({ ...current, [asset.id]: 'uploading' }));
      setUploadProgress((current) => ({ ...current, [asset.id]: 0 }));

      try {
        const uri = await resolveLocalAudioUploadUri(asset);
        const song = await adminService.uploadSong(
          uri,
          asset.filename,
          asset.mimeType || inferAudioMimeType(asset.filename),
          (progress) => {
            setUploadProgress((current) => ({ ...current, [asset.id]: progress }));
          }
        );

        queryClient.setQueryData<SyncResponse>(['sync'], (cache) => mergeUploadedSong(cache, song));
        setUploadStatus((current) => ({ ...current, [asset.id]: 'done' }));
        setUploadProgress((current) => ({ ...current, [asset.id]: 1 }));
        setSelectedLocalIds((current) => {
          const next = new Set(current);
          next.delete(asset.id);
          return next;
        });
      } catch {
        failed += 1;
        setUploadStatus((current) => ({ ...current, [asset.id]: 'error' }));
      }
    }

    queryClient.invalidateQueries({ queryKey: ['sync'] });
    if (failed > 0) {
      Alert.alert('Upload incomplete', `${failed} song${failed !== 1 ? 's' : ''} could not be uploaded.`);
    }
  }

  function handlePlay(song: Song) {
    playSong(song, sortedSongs);
  }

  function handlePlayLocal(asset: LocalAudioAsset) {
    const song: Song = {
      id: asset.id,
      title: asset.filename.replace(/\.[^/.]+$/, ""), // remove extension
      artist: 'Unknown Artist',
      album: null,
      genre: null,
      trackNumber: null,
      duration: asset.duration || 0,
      fileSize: asset.size || 0,
      r2ObjectKey: '',
      artworkUrl: null,
      needsReview: 0,
      checksum: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localUri: asset.uri,
    };

    const localQueue: Song[] = localAssets.map(a => ({
      id: a.id,
      title: a.filename.replace(/\.[^/.]+$/, ""),
      artist: 'Unknown Artist',
      album: null,
      genre: null,
      trackNumber: null,
      duration: a.duration || 0,
      fileSize: a.size || 0,
      r2ObjectKey: '',
      artworkUrl: null,
      needsReview: 0,
      checksum: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localUri: a.uri,
    }));

    playSong(song, localQueue);
  }

  async function handleDownload(song: Song) {
    if (downloadingIds.has(song.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(song.id));
    try {
      await DownloadService.downloadSong(song);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  }

  function confirmDelete(song: Song) {
    Alert.alert(
      'Delete song',
      `Delete "${song.title}" from SonicVault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSong(song),
        },
      ]
    );
  }

  async function deleteSong(song: Song) {
    if (deletingIds.has(song.id)) return;

    setDeletingIds((prev) => new Set(prev).add(song.id));
    try {
      await adminService.deleteSong(song.id);
      await DownloadService.removeSong(song.id);
      removeSongFromLibrary(song.id);
      queryClient.setQueryData<SyncResponse>(['sync'], (cache) => removeCachedSong(cache, song.id));
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    } catch (error: any) {
      Alert.alert('Delete failed', error?.message || 'Could not delete this song.');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  }

  function renderVaultSong({ item }: { item: Song }) {
    const isDeleting = deletingIds.has(item.id);

    return (
      <TouchableOpacity
        style={styles.songRow}
        onPress={() => handlePlay(item)}
        activeOpacity={0.6}
      >
        <View style={styles.songArtwork}>
          {item.artworkUrl ? (
            <Image
              source={{ uri: getImageUrl(item.artworkUrl, item.id) || undefined }}
              style={styles.songImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.songPlaceholder}>
              <Ionicons name="musical-note" size={18} color={colors.textTertiary} />
            </View>
          )}
        </View>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {item.artist}{item.album ? ` · ${item.album}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleDownload(item)}
          disabled={isDownloaded(item.id) || downloadingIds.has(item.id)}
        >
          <Ionicons
            name={isDownloaded(item.id) ? 'checkmark-circle' : 'download-outline'}
            size={20}
            color={isDownloaded(item.id) ? colors.primary : colors.textTertiary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => confirmDelete(item)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <Ionicons name="trash-outline" size={19} color={colors.error} />
          )}
        </TouchableOpacity>
        <Text style={styles.songDuration}>{formatDuration(item.duration)}</Text>
      </TouchableOpacity>
    );
  }

  function renderLocalSong({ item }: { item: LocalAudioAsset }) {
    const selected = selectedLocalIds.has(item.id);
    const status = uploadStatus[item.id];
    const progress = uploadProgress[item.id] || 0;

    return (
      <TouchableOpacity
        style={[styles.localRow, selected && styles.localRowSelected]}
        onPress={() => handlePlayLocal(item)}
        activeOpacity={0.7}
      >
        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => toggleLocalSelection(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={selected ? colors.primary : colors.textTertiary}
          />
        </TouchableOpacity>
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{item.filename}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {item.duration ? formatDuration(item.duration) : formatFileSize(item.size || 0)}
          </Text>
          {status === 'uploading' && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
        </View>
        {status === 'done' && <Ionicons name="cloud-done" size={20} color={colors.primary} />}
        {status === 'error' && <Ionicons name="alert-circle" size={20} color={colors.error} />}
        {status === 'uploading' && <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Library</Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'vault'
              ? `${allSongs.length} song${allSongs.length !== 1 ? 's' : ''}`
              : `${localAssets.length} local song${localAssets.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>

      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentButton, mode === 'vault' && styles.segmentButtonActive]}
          onPress={() => setMode('vault')}
        >
          <Ionicons name="library" size={16} color={mode === 'vault' ? colors.background : colors.textSecondary} />
          <Text style={[styles.segmentText, mode === 'vault' && styles.segmentTextActive]}>Vault</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, mode === 'local' && styles.segmentButtonActive]}
          onPress={() => setMode('local')}
        >
          <Ionicons name="phone-portrait-outline" size={16} color={mode === 'local' ? colors.background : colors.textSecondary} />
          <Text style={[styles.segmentText, mode === 'local' && styles.segmentTextActive]}>Local</Text>
        </TouchableOpacity>
      </View>

      {mode === 'vault' ? (
        allSongs.length > 0 ? (
          <FlatList
            data={sortedSongs}
            keyExtractor={(item) => item.id}
            renderItem={renderVaultSong}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No songs yet</Text>
            <Text style={styles.emptySubtitle}>Upload from Local or Admin</Text>
          </View>
        )
      ) : (
        <View style={styles.localContainer}>
          <View style={styles.localActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={loadLocalAudio} disabled={isLoadingLocal}>
              {isLoadingLocal ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.text} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePickFiles}>
              <Ionicons name="folder-open-outline" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, selectedLocalAssets.length === 0 && styles.buttonDisabled]}
              onPress={handleUploadSelected}
              disabled={selectedLocalAssets.length === 0}
            >
              <Ionicons name="cloud-upload" size={18} color={colors.background} />
              <Text style={styles.uploadButtonText}>
                Upload {selectedLocalAssets.length > 0 ? selectedLocalAssets.length : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {localMessage && (
            <Text style={styles.localMessage}>{localMessage}</Text>
          )}

          {isLoadingLocal ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : localAssets.length > 0 ? (
            <FlatList
              data={localAssets}
              keyExtractor={(item) => item.id}
              renderItem={renderLocalSong}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No local songs</Text>
              <Text style={styles.emptySubtitle}>Use the folder button</Text>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
    borderRadius: 8,
  },
  localRowSelected: {
    backgroundColor: colors.surface,
  },
  checkboxContainer: {
    padding: 4,
    marginRight: 4,
  },
  songArtwork: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
  },
  songImage: {
    width: '100%',
    height: '100%',
  },
  songPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
    gap: 2,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  songArtist: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  songDuration: {
    fontSize: 13,
    color: colors.textTertiary,
    width: 38,
    textAlign: 'right',
  },
  iconButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localContainer: {
    flex: 1,
  },
  localActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  secondaryButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  localMessage: {
    color: colors.textTertiary,
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    width: 38,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  loader: {
    marginTop: 48,
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
