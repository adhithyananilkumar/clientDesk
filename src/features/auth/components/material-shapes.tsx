import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * A small cluster of flat, Material-style shapes (a 9-scallop cookie, a
 * four-leaf clover, a soft burst, a pill and an arch) in tonal greys with one
 * bright piece. It is decoration, not illustration. Each welcome message has
 * its own arrangement; when the message changes the shapes glide, resize and
 * turn into the new one on a soft spring. The scalloped shapes also turn very
 * slowly on their own.
 */
export const SHAPES_WIDTH = 240;
export const SHAPES_HEIGHT = 156;

/** Closed path in a 100 × 100 box: a circle with `lobes` soft bumps of `depth`. */
function lobedPath(lobes: number, depth: number) {
  const steps = 144;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = 50 * (1 - depth) + 50 * depth * ((1 + Math.cos(lobes * t)) / 2);
    const x = 50 + r * Math.cos(t - Math.PI / 2);
    const y = 50 + r * Math.sin(t - Math.PI / 2);
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const COOKIE = lobedPath(9, 0.12);
const CLOVER = lobedPath(4, 0.34);
const BURST = lobedPath(8, 0.16);

type Pose = { x: number; y: number; w: number; h: number; r: number };
type Kind = 'cookie' | 'clover' | 'burst' | 'pill' | 'arch';
type Tone = 'accent' | 'high' | 'mid' | 'low';

const SHAPES: { kind: Kind; tone: Tone; spins?: boolean; poses: [Pose, Pose, Pose] }[] = [
  {
    kind: 'cookie',
    tone: 'mid',
    spins: true,
    poses: [
      { x: 74, y: 88, w: 76, h: 76, r: 0 },
      { x: 166, y: 70, w: 80, h: 80, r: 40 },
      { x: 116, y: 72, w: 84, h: 84, r: 80 },
    ],
  },
  {
    kind: 'clover',
    tone: 'accent',
    poses: [
      { x: 138, y: 58, w: 50, h: 50, r: 0 },
      { x: 78, y: 104, w: 46, h: 46, r: 45 },
      { x: 48, y: 52, w: 40, h: 40, r: 90 },
    ],
  },
  {
    kind: 'pill',
    tone: 'high',
    poses: [
      { x: 170, y: 120, w: 84, h: 32, r: 0 },
      { x: 92, y: 40, w: 84, h: 30, r: -30 },
      { x: 116, y: 140, w: 124, h: 14, r: 0 },
    ],
  },
  {
    kind: 'arch',
    tone: 'low',
    poses: [
      { x: 202, y: 54, w: 40, h: 52, r: 0 },
      { x: 214, y: 124, w: 36, h: 46, r: 90 },
      { x: 196, y: 60, w: 44, h: 56, r: 0 },
    ],
  },
  {
    kind: 'burst',
    tone: 'low',
    spins: true,
    poses: [
      { x: 30, y: 34, w: 32, h: 32, r: 0 },
      { x: 150, y: 132, w: 30, h: 30, r: 20 },
      { x: 202, y: 124, w: 32, h: 32, r: 45 },
    ],
  },
];

/** Soft, slightly heavy: settles without bouncing around. */
const SPRING = { damping: 20, stiffness: 80, mass: 1 } as const;
const STAGGER = 50;

function Shape({
  kind,
  color,
  poses,
  step,
  order,
  spin,
}: {
  kind: Kind;
  color: string;
  poses: [Pose, Pose, Pose];
  step: number;
  order: number;
  /** Shared slow 0 → 1 loop, or null for shapes that do not turn on their own. */
  spin: SharedValue<number> | null;
}) {
  const start = poses[0];
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const w = useSharedValue(start.w);
  const h = useSharedValue(start.h);
  const r = useSharedValue(start.r);

  useEffect(() => {
    const p = poses[step];
    const go = (v: SharedValue<number>, to: number) =>
      v.set(withDelay(order * STAGGER, withSpring(to, SPRING)));
    go(x, p.x);
    go(y, p.y);
    go(w, p.w);
    go(h, p.h);
    go(r, p.r);
  }, [step, poses, order, x, y, w, h, r]);

  const style = useAnimatedStyle(() => {
    const width = w.get();
    const height = h.get();
    const corners =
      kind === 'pill'
        ? { borderRadius: Math.min(width, height) / 2 }
        : kind === 'arch'
          ? { borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }
          : {};
    return {
      width,
      height,
      ...corners,
      transform: [
        { translateX: x.get() - width / 2 },
        { translateY: y.get() - height / 2 },
        { rotate: `${r.get() + (spin ? spin.get() * 360 : 0)}deg` },
      ],
    };
  });

  const path = kind === 'cookie' ? COOKIE : kind === 'clover' ? CLOVER : kind === 'burst' ? BURST : null;

  return (
    <Animated.View style={[styles.shape, path ? null : { backgroundColor: color }, style]}>
      {path ? (
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Path d={path} fill={color} />
        </Svg>
      ) : null}
    </Animated.View>
  );
}

export function MaterialShapes({ step }: { step: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.set(withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(spin);
  }, [reduceMotion, spin]);

  const tones: Record<Tone, string> = {
    accent: theme.text,
    high: theme.textSecondary + '66',
    mid: theme.textSecondary + '3D',
    low: theme.textSecondary + '26',
  };

  return (
    <View
      style={styles.canvas}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {SHAPES.map((shape, i) => (
        <Shape
          key={shape.kind}
          kind={shape.kind}
          color={tones[shape.tone]}
          poses={shape.poses}
          step={step % 3}
          order={i}
          spin={shape.spins ? spin : null}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: SHAPES_WIDTH, height: SHAPES_HEIGHT },
  shape: { position: 'absolute', left: 0, top: 0 },
});
