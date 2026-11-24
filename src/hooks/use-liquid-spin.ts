import { useEffect } from 'react';
import {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/motion';

type Options = {
  /** Milliseconds per quarter turn. */
  period?: number;
  paused?: boolean;
};

/**
 * Drives the brand mark's signature motion entirely on the UI thread.
 *
 * Returns the raw `progress` (0 → 1, repeating) and a ready-made style that turns
 * the target a quarter turn per cycle while squashing it slightly at the fastest
 * point. Respects the system "reduce motion" setting by holding still.
 */
export function useLiquidSpin({ period = Motion.loaderPeriod, paused = false }: Options = {}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.set(0);
    if (paused || reduceMotion) return;

    progress.set(withRepeat(withTiming(1, { duration: period, easing: Motion.liquid }), -1, false));
    return () => cancelAnimation(progress);
  }, [paused, reduceMotion, period, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      transform: [
        { rotate: `${p * 90}deg` },
        { scale: interpolate(p, [0, 0.5, 1], [1, Motion.squash, 1]) },
      ],
    };
  });

  return { progress, style };
}
