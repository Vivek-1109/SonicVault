import { create } from 'zustand';
import { getItem, setItem, KEYS } from '../utils/storage';
import type { Song, PlayerState, PlayerActions, RepeatMode } from '../types';

type PlayerStore = PlayerState & PlayerActions;

interface PlayerPrefs {
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
}

/**
 * Fisher-Yates shuffle: shuffles array in-place and returns it.
 * Keeps the current song at index 0 so playback continues seamlessly.
 */
function fisherYatesShuffle(arr: Song[], currentIndex: number): Song[] {
  const result = [...arr];
  // Move current song to index 0
  if (currentIndex > 0 && currentIndex < result.length) {
    const current = result[currentIndex];
    result.splice(currentIndex, 1);
    result.unshift(current);
  }

  // Shuffle everything after index 0
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i) + 1; // start from 1 to keep index 0 in place
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

async function loadPrefs(): Promise<PlayerPrefs> {
  const prefs = await getItem<PlayerPrefs>(KEYS.PLAYER_PREFS);
  return prefs ?? { shuffleEnabled: false, repeatMode: 'off' };
}

async function savePrefs(prefs: PlayerPrefs): Promise<void> {
  await setItem(KEYS.PLAYER_PREFS, prefs);
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  // Hydrate preferences on store creation
  loadPrefs().then((prefs) => {
    set({
      shuffleEnabled: prefs.shuffleEnabled,
      repeatMode: prefs.repeatMode,
    });
  });

  return {
    // State
    currentSong: null,
    queue: [],
    originalQueue: [],
    currentIndex: -1,
    isPlaying: false,
    isBuffering: false,
    positionMs: 0,
    durationMs: 0,
    shuffleEnabled: false,
    repeatMode: 'off' as RepeatMode,
    volume: 1,
    seekCommand: null as number | null,

    // Actions
    playSong: (song: Song, queue?: Song[], startIndex?: number) => {
      const { shuffleEnabled } = get();
      const newQueue = queue ?? [song];
      const idx = startIndex ?? newQueue.findIndex((s) => s.id === song.id);
      const effectiveIndex = idx >= 0 ? idx : 0;

      if (shuffleEnabled) {
        const shuffled = fisherYatesShuffle(newQueue, effectiveIndex);
        set({
          currentSong: song,
          queue: shuffled,
          originalQueue: [...newQueue],
          currentIndex: 0,
          isPlaying: true,
          isBuffering: true,
          positionMs: 0,
          durationMs: 0,
        });
      } else {
        set({
          currentSong: song,
          queue: [...newQueue],
          originalQueue: [...newQueue],
          currentIndex: effectiveIndex,
          isPlaying: true,
          isBuffering: true,
          positionMs: 0,
          durationMs: 0,
        });
      }
    },

    pause: () => set({ isPlaying: false }),

    resume: () => set({ isPlaying: true }),

    seekTo: (positionMs: number) => set({ seekCommand: positionMs }),
    clearSeekCommand: () => set({ seekCommand: null }),

    nextTrack: () => {
      const { queue, currentIndex, repeatMode } = get();
      if (queue.length === 0) return;

      let nextIndex: number;

      if (repeatMode === 'one') {
        // Repeat current track — reset position, keep playing
        set({ positionMs: 0, isPlaying: true, isBuffering: true });
        return;
      }

      nextIndex = currentIndex + 1;

      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // No repeat — stop at end
          set({ isPlaying: false });
          return;
        }
      }

      set({
        currentSong: queue[nextIndex],
        currentIndex: nextIndex,
        isPlaying: true,
        isBuffering: true,
        positionMs: 0,
        durationMs: 0,
      });
    },

    previousTrack: () => {
      const { queue, currentIndex, positionMs } = get();
      if (queue.length === 0) return;

      // If more than 3 seconds in, restart current track
      if (positionMs > 3000) {
        set({ positionMs: 0, seekCommand: 0 });
        return;
      }

      const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;

      set({
        currentSong: queue[prevIndex],
        currentIndex: prevIndex,
        isPlaying: true,
        isBuffering: true,
        positionMs: 0,
        durationMs: 0,
      });
    },

    toggleShuffle: () => {
      const { shuffleEnabled, queue, originalQueue, currentSong, currentIndex } = get();
      const newShuffleEnabled = !shuffleEnabled;

      if (newShuffleEnabled) {
        // Shuffle the queue, keeping current song at position 0
        const shuffled = fisherYatesShuffle(queue, currentIndex);
        set({
          shuffleEnabled: true,
          queue: shuffled,
          currentIndex: 0,
        });
      } else {
        // Restore original order, find current song's original position
        const originalIndex = originalQueue.findIndex((s) => s.id === currentSong?.id);
        set({
          shuffleEnabled: false,
          queue: [...originalQueue],
          currentIndex: originalIndex >= 0 ? originalIndex : 0,
        });
      }

      savePrefs({ shuffleEnabled: newShuffleEnabled, repeatMode: get().repeatMode });
    },

    cycleRepeat: () => {
      const { repeatMode, shuffleEnabled } = get();
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentModeIndex = modes.indexOf(repeatMode);
      const nextMode = modes[(currentModeIndex + 1) % modes.length];

      set({ repeatMode: nextMode });
      savePrefs({ shuffleEnabled, repeatMode: nextMode });
    },

    addToQueue: (song: Song) => {
      const { queue, originalQueue } = get();
      set({
        queue: [...queue, song],
        originalQueue: [...originalQueue, song],
      });
    },

    removeFromQueue: (index: number) => {
      const { queue, originalQueue, currentIndex, currentSong } = get();
      if (index < 0 || index >= queue.length) return;

      const removedSong = queue[index];
      const newQueue = queue.filter((_, i) => i !== index);
      const newOriginalQueue = originalQueue.filter((s) => s.id !== removedSong.id);

      let newIndex = currentIndex;
      if (index < currentIndex) {
        newIndex = currentIndex - 1;
      } else if (index === currentIndex) {
        // Current song removed — play the next song at same index or stop
        if (newQueue.length === 0) {
          set({
            queue: [],
            originalQueue: [],
            currentSong: null,
            currentIndex: -1,
            isPlaying: false,
          });
          return;
        }
        newIndex = Math.min(currentIndex, newQueue.length - 1);
        set({
          queue: newQueue,
          originalQueue: newOriginalQueue,
          currentIndex: newIndex,
          currentSong: newQueue[newIndex],
          isBuffering: true,
          positionMs: 0,
          durationMs: 0,
        });
        return;
      }

      set({
        queue: newQueue,
        originalQueue: newOriginalQueue,
        currentIndex: newIndex,
      });
    },

    reorderQueue: (fromIndex: number, toIndex: number) => {
      const { queue, currentIndex } = get();
      const newQueue = [...queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);

      // Adjust current index if affected
      let newCurrentIndex = currentIndex;
      if (fromIndex === currentIndex) {
        newCurrentIndex = toIndex;
      } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
        newCurrentIndex = currentIndex - 1;
      } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
        newCurrentIndex = currentIndex + 1;
      }

      set({
        queue: newQueue,
        currentIndex: newCurrentIndex,
      });
    },

    clearQueue: () => {
      const { currentSong } = get();
      if (currentSong) {
        // Keep current song, clear the rest
        set({
          queue: [currentSong],
          originalQueue: [currentSong],
          currentIndex: 0,
        });
      } else {
        set({
          queue: [],
          originalQueue: [],
          currentIndex: -1,
        });
      }
    },

    removeSongFromLibrary: (songId: string) => {
      const { queue, originalQueue, currentSong, currentIndex, isPlaying } = get();
      const removedIndex = queue.findIndex((song) => song.id === songId);
      if (removedIndex === -1 && !originalQueue.some((song) => song.id === songId)) return;

      const newQueue = queue.filter((song) => song.id !== songId);
      const newOriginalQueue = originalQueue.filter((song) => song.id !== songId);

      if (currentSong?.id === songId) {
        if (newQueue.length === 0) {
          set({
            currentSong: null,
            queue: [],
            originalQueue: [],
            currentIndex: -1,
            isPlaying: false,
            isBuffering: false,
            positionMs: 0,
            durationMs: 0,
            seekCommand: null,
          });
          return;
        }

        const nextIndex = Math.min(Math.max(currentIndex, 0), newQueue.length - 1);
        set({
          currentSong: newQueue[nextIndex],
          queue: newQueue,
          originalQueue: newOriginalQueue,
          currentIndex: nextIndex,
          isPlaying,
          isBuffering: true,
          positionMs: 0,
          durationMs: 0,
          seekCommand: null,
        });
        return;
      }

      const nextIndex =
        removedIndex !== -1 && currentIndex > removedIndex
          ? Math.max(currentIndex - 1, -1)
          : currentIndex;

      set({
        queue: newQueue,
        originalQueue: newOriginalQueue,
        currentIndex: nextIndex,
      });
    },

    setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

    setIsBuffering: (buffering: boolean) => set({ isBuffering: buffering }),

    setPosition: (positionMs: number) => set({ positionMs }),

    setDuration: (durationMs: number) => set({ durationMs }),
  };
});
