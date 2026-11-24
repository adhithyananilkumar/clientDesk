import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LogoMark, Wordmark } from '@/components/brand';
import { Button, Screen, ThemedText } from '@/components/ui';
import { Motion } from '@/constants/motion';
import { riseIn } from '@/constants/motion-presets';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AMBIENT_HEIGHT, AMBIENT_WIDTH, AmbientShapes } from '../components/ambient-shapes';

const SLIDES = [
  {
    headline: 'Every client.\nOne desk.',
    lead: 'Tickets, conversations and your team, together in one calm place.',
  },
  {
    headline: 'Reply faster.\nStress less.',
    lead: 'Every request lands in one shared inbox, sorted and ready to answer.',
  },
  {
    headline: 'Your team,\nin sync.',
    lead: 'Assign, mention and hand off work without ever losing the thread.',
  },
] as const;

/** How long each message stays before the next one drops in. */
const SLIDE_MS = 4200;

const DOT_SPRING = { damping: 20, stiffness: 160, mass: 0.9 } as const;

/**
 * The incoming quote drops down from above and, being an under-damped spring,
 * overshoots a little and bobs a couple of times before it settles.
 * The outgoing one sinks and fades. Movement is vertical only, so nothing is
 * ever clipped at the screen edges.
 */
const quoteIn = FadeInUp.withInitialValues({ transform: [{ translateY: -28 }] })
  .springify()
  .damping(9)
  .stiffness(140)
  .mass(0.8);
const quoteOut = FadeOutDown.duration(220);

/** Pill indicator: the active dot stretches into a bar. */
function Dot({ active, onPress, index }: { active: boolean; onPress: () => void; index: number }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 22 : 6, DOT_SPRING),
    opacity: withSpring(active ? 1 : 0.35, DOT_SPRING),
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show message ${index + 1} of ${SLIDES.length}`}
      accessibilityState={{ selected: active }}
      hitSlop={10}
      onPress={onPress}>
      <Animated.View style={[styles.dot, { backgroundColor: theme.text }, style]} />
    </Pressable>
  );
}

/** First thing a signed-out user sees: brand lockup, rotating promise, two clear choices. */
export function WelcomeScreen() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  // Counts every change (not the slide number), so the mark always turns forward.
  const [turns, setTurns] = useState(0);

  const goTo = (next: number) => {
    if (next === index) return;
    setIndex(next);
    setTurns((t) => t + 1);
  };

  // Restarts whenever the slide changes, so a tap on a dot gets a full read before moving on.
  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
      setTurns((t) => t + 1);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index]);

  // One "flap" per quote: a liquid quarter turn clockwise with a brief squash.
  // The mark is four-fold symmetric, so every quarter turn lands on the same shape.
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (turns === 0 || reduceMotion) return;
    rotation.set(withTiming(turns * 90, { duration: 900, easing: Motion.liquid }));
    scale.set(withSequence(withTiming(Motion.squash, { duration: 380 }), withSpring(1)));
  }, [turns, reduceMotion, rotation, scale]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }, { scale: scale.get() }],
  }));

  const slide = SLIDES[index];

  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const artScale = stage
    ? Math.min(stage.width / AMBIENT_WIDTH, (stage.height - Spacing.four) / AMBIENT_HEIGHT, 1.3)
    : 1;

  return (
    <Screen>
      <Animated.View entering={riseIn(0)} style={styles.brand}>
        <Animated.View style={markStyle}>
          <LogoMark size={52} />
        </Animated.View>
        <Wordmark size={24} />
      </Animated.View>

      {/* Middle: quiet abstract shapes that re-arrange with each message, scaled to the free space. */}
      <View style={styles.stage} onLayout={(event) => setStage(event.nativeEvent.layout)}>
        {stage ? (
          <Animated.View entering={riseIn(1)} style={{ transform: [{ scale: artScale }] }}>
            <AmbientShapes step={index} />
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={riseIn(1)} style={styles.copy}>
        <Pressable
          accessibilityRole="text"
          accessibilityLabel={`${slide.headline.replace('\n', ' ')} ${slide.lead}`}
          onPress={() => goTo((index + 1) % SLIDES.length)}
          style={styles.slideFrame}>
          {/* Keyed so the old quote sinks away while the new one drops in. */}
          <Animated.View key={index} entering={quoteIn} exiting={quoteOut} style={styles.slide}>
            <ThemedText style={styles.headline}>{slide.headline}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.lead}>
              {slide.lead}
            </ThemedText>
          </Animated.View>
        </Pressable>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Dot key={i} index={i} active={i === index} onPress={() => goTo(i)} />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={riseIn(2)} style={styles.actions}>
        <Button title="Create account" onPress={() => router.push('/sign-up')} />
        <Button title="Log in" variant="ghost" onPress={() => router.push('/sign-in')} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Lockup at the top, left-aligned with the copy.
  brand: { alignItems: 'flex-start', gap: Spacing.two, paddingTop: Spacing.three },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: Spacing.four, paddingBottom: Spacing.five },
  // Fixed height so the buttons never jump while quotes swap. Not clipped, so the
  // bounce and the sideways extent of the text are always fully visible.
  slideFrame: { height: 176 },
  slide: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.three },
  headline: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -1.1 },
  lead: { fontSize: 17, lineHeight: 24, maxWidth: 340 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { height: 6, borderRadius: 3 },
  actions: { gap: Spacing.two + Spacing.one, paddingBottom: Spacing.four },
});
