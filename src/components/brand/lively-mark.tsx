import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/constants/motion';

import { LogoMark, type MarkTone } from './logo-mark';

type LivelyMarkProps = {
  size?: number;
  tone?: MarkTone;
  /** Random pause between gestures, in ms. */
  pause?: [min: number, max: number];
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_PAUSE: [number, number] = [2400, 4800];

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * The brand mark with a bit of life: every few seconds it does one small,
 * randomly picked gesture (a liquid quarter turn either way, a squash-and-pop,
 * or a curious wobble) and then rests. The mark has four-fold symmetry, so a
 * quarter turn always lands back on the same silhouette.
 * Stays still when the OS "reduce motion" setting is on.
 */
export function LivelyMark({ size = 56, tone = 'auto', pause = DEFAULT_PAUSE, style }: LivelyMarkProps) {
  const [pauseMin, pauseMax] = pause;
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    let last = -1;

    const play = () => {
      let move = Math.floor(Math.random() * 4);
      if (move === last) move = (move + 1) % 4; // never repeat the same gesture twice in a row
      last = move;
      const turn = { duration: 950, easing: Motion.liquid };

      switch (move) {
        case 0: // liquid quarter turn, clockwise
          rotation.set(withTiming(rotation.get() + 90, turn));
          scale.set(withSequence(withTiming(Motion.squash, { duration: 420 }), withSpring(1)));
          break;
        case 1: // and the other way
          rotation.set(withTiming(rotation.get() - 90, turn));
          scale.set(withSequence(withTiming(Motion.squash, { duration: 420 }), withSpring(1)));
          break;
        case 2: // squash, then pop back with a soft bounce
          scale.set(
            withSequence(
              withTiming(0.8, { duration: 200, easing: Easing.out(Easing.quad) }),
              withSpring(1, { damping: 6, stiffness: 240, mass: 0.6 }),
            ),
          );
          break;
        default: {
          // a little curious wobble
          const base = rotation.get();
          const ease = { duration: 160, easing: Easing.inOut(Easing.sin) };
          rotation.set(
            withSequence(
              withTiming(base + 14, ease),
              withTiming(base - 10, ease),
              withSpring(base, { damping: 8, stiffness: 180 }),
            ),
          );
        }
      }
      timer = setTimeout(play, randomBetween(pauseMin, pauseMax));
    };

    timer = setTimeout(play, randomBetween(700, 1400));
    return () => {
      clearTimeout(timer);
      cancelAnimation(rotation);
      cancelAnimation(scale);
    };
  }, [reduceMotion, pauseMin, pauseMax, rotation, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }, { scale: scale.get() }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style, animatedStyle]}>
      <LogoMark size={size} tone={tone} />
    </Animated.View>
  );
}
