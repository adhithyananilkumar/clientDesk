import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
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

import { useTheme } from '@/hooks/use-theme';

/**
 * Quiet, abstract composition for the welcome screen: a handful of rings, soft
 * discs, a pill, an arc and one bright dot. It does not illustrate anything.
 * Each welcome message has its own arrangement, and when the message changes
 * every shape glides to its new place on a soft spring, slightly staggered, so
 * the whole thing reads as one slow, liquid re-composition. Between changes the
 * shapes drift a few pixels on their own. Monochrome, using theme tokens only.
 */
export const AMBIENT_WIDTH = 300;
export const AMBIENT_HEIGHT = 240;

type Pose = { x: number; y: number; w: number; h: number; r: number };
type Kind = 'ring' | 'disc' | 'pill' | 'arc' | 'accent' | 'dot';

/** Centre x/y, width/height and rotation (deg) of each shape, per message. */
const SHAPES: { kind: Kind; poses: [Pose, Pose, Pose] }[] = [
  {
    kind: 'disc',
    poses: [
      { x: 150, y: 122, w: 112, h: 112, r: 0 },
      { x: 196, y: 98, w: 124, h: 124, r: 0 },
      { x: 186, y: 120, w: 120, h: 120, r: 0 },
    ],
  },
  {
    kind: 'ring',
    poses: [
      { x: 150, y: 122, w: 196, h: 196, r: 0 },
      { x: 112, y: 140, w: 150, h: 150, r: 0 },
      { x: 114, y: 120, w: 120, h: 120, r: 0 },
    ],
  },
  {
    kind: 'arc',
    poses: [
      { x: 150, y: 122, w: 150, h: 150, r: -45 },
      { x: 196, y: 98, w: 176, h: 176, r: 90 },
      { x: 150, y: 120, w: 216, h: 216, r: 200 },
    ],
  },
  {
    kind: 'pill',
    poses: [
      { x: 64, y: 54, w: 78, h: 26, r: -28 },
      { x: 92, y: 204, w: 104, h: 26, r: -12 },
      { x: 150, y: 214, w: 132, h: 6, r: 0 },
    ],
  },
  {
    kind: 'dot',
    poses: [
      { x: 252, y: 196, w: 20, h: 20, r: 0 },
      { x: 50, y: 52, w: 16, h: 16, r: 0 },
      { x: 150, y: 24, w: 16, h: 16, r: 0 },
    ],
  },
  {
    kind: 'accent',
    poses: [
      { x: 150, y: 122, w: 12, h: 12, r: 0 },
      { x: 252, y: 46, w: 12, h: 12, r: 0 },
      { x: 150, y: 120, w: 12, h: 12, r: 0 },
    ],
  },
];

/** Soft and slightly heavy: settles without bouncing around. */
const SPRING = { damping: 20, stiffness: 70, mass: 1.1 } as const;
const STAGGER = 55;

function Shape({
  kind,
  poses,
  step,
  order,
  drift,
  look,
}: {
  kind: Kind;
  poses: [Pose, Pose, Pose];
  step: number;
  order: number;
  drift: SharedValue<number>;
  look: ViewStyle;
}) {
  const start = poses[0];
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const w = useSharedValue(start.w);
  const h = useSharedValue(start.h);
  const r = useSharedValue(start.r);

  useEffect(() => {
    const p = poses[step];
    const go = (v: SharedValue<number>, to: number) => v.set(withDelay(order * STAGGER, withSpring(to, SPRING)));
    go(x, p.x);
    go(y, p.y);
    go(w, p.w);
    go(h, p.h);
    go(r, p.r);
  }, [step, poses, order, x, y, w, h, r]);

  const style = useAnimatedStyle(() => {
    // Each shape drifts on its own phase so the idle motion never looks mechanical.
    const phase = drift.get() * Math.PI * 2 + order * 1.3;
    const width = w.get();
    const height = h.get();
    return {
      width,
      height,
      borderRadius: Math.min(width, height) / 2,
      transform: [
        { translateX: x.get() - width / 2 + Math.sin(phase) * 3 },
        { translateY: y.get() - height / 2 + Math.cos(phase) * 4 },
        { rotate: `${r.get() + (kind === 'arc' ? drift.get() * 360 * 0.08 : 0)}deg` },
      ],
    };
  });

  return <Animated.View style={[styles.shape, look, style]} />;
}

export function AmbientShapes({ step }: { step: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.set(withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(drift);
  }, [reduceMotion, drift]);

  const faint = theme.textSecondary + '40';
  const looks: Record<Kind, ViewStyle> = {
    disc: { backgroundColor: theme.backgroundElement },
    ring: { borderWidth: 1, borderColor: faint },
    arc: {
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderTopColor: theme.textSecondary + '99',
      borderRightColor: theme.textSecondary + '99',
    },
    pill: { backgroundColor: theme.backgroundSelected },
    dot: { borderWidth: 1, borderColor: theme.textSecondary + '80' },
    accent: { backgroundColor: theme.text },
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
          poses={shape.poses}
          step={step % 3}
          order={i}
          drift={drift}
          look={looks[shape.kind]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: AMBIENT_WIDTH, height: AMBIENT_HEIGHT },
  shape: { position: 'absolute', left: 0, top: 0 },
});
