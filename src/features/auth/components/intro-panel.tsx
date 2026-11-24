import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { TurningMark } from './turning-mark';

/** The mark takes one quarter turn this often, so the screen never feels frozen. */
const TURN_MS = 4200;
const GLOW = 220;

/**
 * Soft light behind the mark: a radial fade from a faint tint of the text
 * colour to nothing, slowly breathing. Gives the logo depth without adding
 * another object to the screen.
 */
function Glow({ size }: { size: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    breath.set(withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [reduceMotion, breath]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.7 + breath.get() * 0.3,
    transform: [{ scale: 0.92 + breath.get() * 0.12 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.glow, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="introGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={theme.text} stopOpacity={0.14} />
            <Stop offset="0.45" stopColor={theme.text} stopOpacity={0.05} />
            <Stop offset="1" stopColor={theme.text} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#introGlow)" />
      </Svg>
    </Animated.View>
  );
}

type IntroPanelProps = {
  onSignIn: () => void;
  onSignUp: () => void;
};

/**
 * Welcome: the brand lockup centred in the open space, the two entry points
 * at the bottom. Nothing else competes with the brand. The mark takes a slow
 * quarter turn every few seconds over a softly breathing glow.
 */
export function IntroPanel({ onSignIn, onSignUp }: IntroPanelProps) {
  const [turns, setTurns] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTurns((t) => t + 1), TURN_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.brandArea}>
        <View style={styles.lockup}>
          <View style={styles.markWrap}>
            <Glow size={GLOW} />
            <TurningMark turns={turns} size={80} />
          </View>
          <Wordmark size={28} />
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Create account" onPress={onSignUp} />
        <Button title="Log in" variant="secondary" onPress={onSignIn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Fills everything above the buttons; a little extra top padding sits the brand just below true centre.
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
  },
  lockup: { alignItems: 'center', gap: Spacing.three },
  markWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  actions: { gap: Spacing.two + Spacing.one, paddingTop: Spacing.four, paddingBottom: Spacing.four },
});
