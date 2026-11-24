import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/motion';
import { useLiquidSpin } from '@/hooks/use-liquid-spin';

import { LogoMark, type MarkTone } from '../brand';

export type LoaderProps = {
  size?: number;
  tone?: MarkTone;
  /** Announced by screen readers. */
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The ClientDesk mark, turning. Each quarter turn eases in, sweeps, overshoots a
 * few degrees and settles, while the ribbons swell in sequence around the ring.
 * With "reduce motion" enabled it gently pulses instead of rotating.
 */
export function Loader({ size = 48, tone = 'auto', label = 'Loading', style }: LoaderProps) {
  const reduceMotion = useReducedMotion();
  const { progress, style: spinStyle } = useLiquidSpin({ period: Motion.loaderPeriod });

  const pulse = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.set(1);
    if (!reduceMotion) return;

    pulse.set(
      withRepeat(
        withSequence(withTiming(0.35, { duration: 800 }), withTiming(1, { duration: 800 })),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[{ width: size, height: size }, style, pulseStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <LogoMark size={size} tone={tone} progress={progress} />
      </Animated.View>
    </Animated.View>
  );
}
