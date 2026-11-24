import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LogoMark } from '@/components/brand';
import { Motion } from '@/constants/motion';

/**
 * The brand mark, turning one liquid quarter turn (with a brief squash) each
 * time `turns` goes up. The mark is four-fold symmetric, so every quarter turn
 * lands on the same silhouette. Stays still with "reduce motion" on.
 */
export function TurningMark({ turns, size }: { turns: number; size: number }) {
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (turns === 0 || reduceMotion) return;
    rotation.set(withTiming(turns * 90, { duration: 900, easing: Motion.liquid }));
    scale.set(withSequence(withTiming(Motion.squash, { duration: 380 }), withSpring(1)));
  }, [turns, reduceMotion, rotation, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }, { scale: scale.get() }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <LogoMark size={size} />
    </Animated.View>
  );
}
