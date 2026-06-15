import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, PanResponder, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { colors } from '../constants/colors';

const BAR_COUNT = 40;
const BAR_MARGIN = 1.5;

interface WaveformVisualizerProps {
  progress: number; // 0 to 1
  isPlaying: boolean;
  height?: number;
  style?: ViewStyle;
  onSeek?: (progress: number) => void;
}

function WaveBar({ index, isPlaying, isPlayed, barWidth, height }: {
  index: number;
  isPlaying: boolean;
  isPlayed: boolean;
  barWidth: number;
  height: number;
}) {
  const animation = useSharedValue(0.3);

  useEffect(() => {
    if (isPlaying && isPlayed) {
      // Each bar gets a unique animation pattern based on its index
      const baseDelay = (index % 7) * 40;
      const baseDuration = 300 + (index % 5) * 80;

      animation.value = withDelay(
        baseDelay,
        withRepeat(
          withSequence(
            withTiming(0.3 + Math.random() * 0.7, {
              duration: baseDuration,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(0.15 + Math.random() * 0.3, {
              duration: baseDuration * 0.8,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(0.5 + Math.random() * 0.5, {
              duration: baseDuration * 0.6,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            }),
            withTiming(0.2 + Math.random() * 0.4, {
              duration: baseDuration * 1.1,
              easing: Easing.bezier(0.4, 0, 0.2, 1),
            })
          ),
          -1, // infinite repeat
          true  // reverse
        )
      );
    } else {
      // When paused or not yet played, settle to a static pattern
      const staticHeight = isPlayed ? 0.15 + (index % 3) * 0.08 : 0.08;
      animation.value = withTiming(staticHeight, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [isPlaying, isPlayed]);

  const animatedStyle = useAnimatedStyle(() => {
    const barHeight = interpolate(
      animation.value,
      [0, 1],
      [2, height]
    );

    return {
      height: barHeight,
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: barWidth,
          marginHorizontal: BAR_MARGIN,
          borderRadius: barWidth / 2,
          backgroundColor: isPlayed ? colors.primary : colors.surfaceLight,
        },
        animatedStyle,
      ]}
    />
  );
}

export function WaveformVisualizer({
  progress,
  isPlaying,
  height = 32,
  style,
  onSeek,
}: WaveformVisualizerProps) {
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [scrubPreview, setScrubPreview] = React.useState<number | null>(null);

  const displayProgress = scrubPreview !== null ? scrubPreview : progress;
  const playedBars = Math.floor(displayProgress * BAR_COUNT);
  const barWidth = 3;

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const calculateProgress = (x: number) => {
    if (containerWidth === 0) return 0;
    return Math.max(0, Math.min(1, x / containerWidth));
  };

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !!onSeek,
    onMoveShouldSetPanResponder: () => !!onSeek,
    onPanResponderGrant: (evt) => {
      if (!onSeek) return;
      const x = evt.nativeEvent.locationX;
      setScrubPreview(calculateProgress(x));
    },
    onPanResponderMove: (evt) => {
      if (!onSeek) return;
      const x = evt.nativeEvent.locationX;
      setScrubPreview(calculateProgress(x));
    },
    onPanResponderRelease: (evt) => {
      if (!onSeek) return;
      const x = evt.nativeEvent.locationX;
      const finalProgress = calculateProgress(x);
      setScrubPreview(null);
      onSeek(finalProgress);
    },
    onPanResponderTerminate: () => {
      setScrubPreview(null);
    },
  }), [containerWidth, onSeek]);

  return (
    <View
      style={[styles.container, { height }, style]}
      onLayout={handleLayout}
      {...(onSeek ? panResponder.panHandlers : {})}
    >
      {Array.from({ length: BAR_COUNT }).map((_, index) => (
        <WaveBar
          key={index}
          index={index}
          isPlaying={isPlaying && scrubPreview === null}
          isPlayed={index <= playedBars}
          barWidth={barWidth}
          height={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
