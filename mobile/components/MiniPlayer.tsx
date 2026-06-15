import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated as RNAnimated, Easing } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { usePlayerStore } from '../stores/playerStore';
import { colors } from '../constants/colors';
import { getImageUrl } from '../utils/getImageUrl';

const { width } = Dimensions.get('window');

export function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentSong, isPlaying, isBuffering, pause, resume, positionMs, durationMs, nextTrack, previousTrack } = usePlayerStore();

  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  // Animate progress bar
  useEffect(() => {
    if (durationMs > 0) {
      RNAnimated.timing(progressAnim, {
        toValue: (positionMs / durationMs) * width,
        duration: isPlaying ? 1000 : 0,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [positionMs, durationMs, isPlaying, progressAnim]);

  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10]) // Only activate if moving horizontally
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX < -50) {
        runOnJS(nextTrack)();
      } else if (event.translationX > 50) {
        runOnJS(previousTrack)();
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!currentSong) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, { bottom: 65 }, animatedStyle]}>
        <TouchableOpacity
          style={styles.content}
          activeOpacity={0.9}
          onPress={() => router.push('/player')}
        >
          <View style={styles.artwork}>
            {currentSong.artworkUrl ? (
              <Image
                source={{ uri: getImageUrl(currentSong.artworkUrl, currentSong.id) || undefined }}
                style={styles.image}
                contentFit="cover"
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>♫</Text>
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentSong.artist}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.playButton}
            onPress={isPlaying ? pause : resume}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isBuffering ? (
              <View style={styles.buffering} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color={colors.text}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <RNAnimated.View
            style={[
              styles.progressBar,
              { width: progressAnim },
            ]}
          />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 4,
    right: 4,
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: -2 },
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  info: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  artist: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  playButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buffering: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    borderTopColor: colors.primary,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
