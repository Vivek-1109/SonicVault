import { useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, preload, clearAllPreloadedSources } from 'expo-audio';
import { usePlayerStore } from '../stores/playerStore';
import { useDownloadStore } from '../stores/downloadStore';
import { api } from '../services/api';

export function usePlayer() {
  const { currentSong, isPlaying, queue, currentIndex, nextTrack, setPosition, setDuration, setIsBuffering, setIsPlaying, seekCommand, clearSeekCommand } = usePlayerStore();
  const { getLocalUri } = useDownloadStore();
  
  const [source, setSource] = useState<string | null>(null);
  const player = useAudioPlayer(source || null);
  const status = useAudioPlayerStatus(player);
  
  const currentSongIdRef = useRef<string | undefined>(undefined);
  const hasEndedRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix' as any,
    }).catch(console.warn);
  }, []);

  // Handle Seek Command
  useEffect(() => {
    if (seekCommand !== null && player.isLoaded) {
      // expo-audio seekTo() expects SECONDS; seekCommand is in ms
      player.seekTo(seekCommand / 1000);
      setPosition(seekCommand);
      hasEndedRef.current = false;
      clearSeekCommand();
    }
  }, [seekCommand, player.isLoaded, setPosition, clearSeekCommand, player]);

  // Update source when currentSong changes
  useEffect(() => {
    if (!currentSong) {
      setSource(null);
      currentSongIdRef.current = undefined;
      return;
    }
    
    if (currentSong.id === currentSongIdRef.current) return;
    currentSongIdRef.current = currentSong.id;
    hasEndedRef.current = false;
    setSource(null); // Clear while fetching to prevent playing old song
    setIsBuffering(true);
    
    async function resolveSource() {
      let activeSource = null;
      
      // 1. Check offline downloads first
      const localUri = getLocalUri(currentSong!.id);
      if (localUri) {
        activeSource = localUri;
      } else if (currentSong!.localUri) {
        // 1b. Directly play a local file if provided
        activeSource = currentSong!.localUri;
      } else {
        // 2. Fetch stream URL from backend
        try {
          const res = await api.get(`/api/songs/${currentSong!.id}/stream-url`);
          activeSource = res.data.url;
          // Record play history
          api.post('/api/recently-played', { songId: currentSong!.id }).catch(() => {});
        } catch (err) {
          console.error('Failed to get stream url:', err);
          nextTrack(); // skip to next track on failure
          return;
        }
      }

      setSource(activeSource);
    }
    
    resolveSource();
  }, [currentSong, getLocalUri, nextTrack, setIsBuffering]);

  // Set Media Session Metadata for Lock Screen
  useEffect(() => {
    if (!player || !player.isLoaded || !currentSong) return;
    try {
      if (typeof player.setActiveForLockScreen === 'function') {
        player.setActiveForLockScreen(true, {
          title: currentSong.title,
          artist: currentSong.artist,
          albumTitle: currentSong.album || undefined,
          artworkUrl: currentSong.artworkUrl || undefined,
        }, {
          showSeekForward: true,
          showSeekBackward: true,
        });
      }
    } catch (err) {
      console.warn('Failed to set lock screen metadata', err);
    }
  }, [player, player.isLoaded, currentSong]);

  // Preload next track for instant transitions
  useEffect(() => {
    if (!currentSong || queue.length <= 1) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) return;

    const nextSong = queue[nextIndex];
    if (!nextSong) return;

    async function preloadNextTrack() {
      try {
        // Check if already downloaded locally
        const localUri = getLocalUri(nextSong!.id);
        if (localUri) {
          await preload(localUri).catch(() => {});
          return;
        }

        // Fetch stream URL and preload
        const res = await api.get(`/api/songs/${nextSong!.id}/stream-url`);
        const url = res.data.url;
        if (url) {
          await preload(url).catch(() => {});
        }
      } catch {
        // Preloading is best-effort, silently ignore failures
      }
    }

    preloadNextTrack();

    return () => {
      // Clean up preloaded sources when song changes
      clearAllPreloadedSources().catch(() => {});
    };
  }, [currentSong?.id, currentIndex, queue.length, getLocalUri]);

  // Handle Play/Pause
  useEffect(() => {
    if (!source || !player.isLoaded) return;
    
    if (isPlaying && !player.playing && !hasEndedRef.current) {
      player.play();
    } else if (!isPlaying && player.playing) {
      player.pause();
    }
  }, [isPlaying, source, player.isLoaded, player.playing]);

  // Sync status -> Store
  useEffect(() => {
    if (!status.isLoaded) {
      setIsBuffering(true);
      return;
    }
    
    setIsBuffering(status.isBuffering);
    // expo-audio returns currentTime and duration in SECONDS; store tracks milliseconds
    setPosition(status.currentTime * 1000);
    setDuration((status.duration || 0) * 1000);

    // Track end detection (compare in ms)
    const posMs = status.currentTime * 1000;
    const durMs = (status.duration || 0) * 1000;
    if (durMs > 0 && posMs >= durMs - 500 && !hasEndedRef.current) {
      hasEndedRef.current = true;
      nextTrack();
    }
  }, [
    status.isLoaded,
    status.isBuffering,
    status.currentTime,
    status.duration,
    setIsBuffering,
    setPosition,
    setDuration,
    nextTrack,
  ]);
}
