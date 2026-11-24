import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Motion } from '@/constants/motion';
import { useTheme } from '@/hooks/use-theme';

import { LogoMark, Wordmark } from '../brand';

// Keep the native splash up until the first frame of the launcher is on screen,
// so there is never a blank flash between the two.
SplashScreen.preventAutoHideAsync().catch(() => {});

const L = Motion.launch;

/** The name sits below the mark. Lifting the mark by half of that space centres the lockup. */
const WORDMARK_BOX = 320;
const LIFT = (L.wordmarkSize * 1.25 + L.gap) / 2;

/** Earliest moment the launcher may leave: the intro has played and the lockup has been held. */
const MIN_DURATION = L.liftDelay + L.liftDuration + L.hold;

type AppLauncherProps = {
  children: ReactNode;
  /**
   * Flip to `true` once the app has what it needs to show real content (restored
   * session, loaded fonts, ...). Until then the finished lockup simply stays up.
   * Defaults to `true`, in which case only the intro's own length keeps it on screen.
   */
  ready?: boolean;
};

/**
 * Animated app launch.
 *
 * 1. The native splash (static mark, same size and colours) hands over to this
 *    overlay with no visible change.
 * 2. The mark spins once, smoothly.
 * 3. As the spin finishes, the name rises in below the mark while the mark lifts
 *    to make room, forming the ClientDesk lockup.
 * 4. After a short hold, and once `ready`, the overlay fades away to the app.
 *
 * It plays once per launch and never loops. For loading states inside the app
 * use `<Loader />` or `<LoadingScreen />`.
 */
export function AppLauncher({ children, ready = true }: AppLauncherProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  const spin = useSharedValue(0);
  const lift = useSharedValue(0);
  const reveal = useSharedValue(0);
  const exit = useSharedValue(0);

  const [visible, setVisible] = useState(true);
  const [handedOver, setHandedOver] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  const handleLayout = useCallback(() => {
    if (handedOver) return;
    setHandedOver(true);
    SplashScreen.hideAsync().catch(() => {});
  }, [handedOver]);

  // The intro starts once the user can actually see the launcher.
  useEffect(() => {
    if (!handedOver) return;

    if (reduceMotion) {
      // No spinning or moving: the name just fades in.
      reveal.set(withDelay(200, withTiming(1, { duration: 400 })));
    } else {
      spin.set(withTiming(1, { duration: L.spinDuration, easing: L.spinEase }));
      lift.set(withDelay(L.liftDelay, withTiming(1, { duration: L.liftDuration, easing: L.liftEase })));
      reveal.set(
        withDelay(L.liftDelay + 100, withTiming(1, { duration: L.liftDuration, easing: L.liftEase })),
      );
    }

    const timer = setTimeout(() => setIntroDone(true), reduceMotion ? 1200 : MIN_DURATION);
    return () => clearTimeout(timer);
  }, [handedOver, reduceMotion, spin, lift, reveal]);

  useEffect(() => {
    if (!ready || !introDone) return;
    exit.set(
      withTiming(1, { duration: L.fadeDuration }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setVisible, false);
      }),
    );
  }, [ready, introDone, exit]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(lift.get(), [0, 1], [0, -LIFT]) }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spin.get() * 360}deg` },
      { scale: interpolate(spin.get(), [0, 0.5, 1], [1, L.spinSquash, 1]) },
    ],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateY: interpolate(reveal.get(), [0, 1], [reduceMotion ? 0 : 14, 0]) }],
  }));

  return (
    <View style={styles.root}>
      {children}
      {visible ? (
        <Animated.View
          onLayout={handleLayout}
          style={[styles.overlay, { backgroundColor: theme.background }, overlayStyle]}>
          <Animated.View style={[styles.lockup, liftStyle]}>
            <Animated.View style={spinStyle}>
              <LogoMark size={L.markSize} progress={spin} />
            </Animated.View>
            <Animated.View style={[styles.name, nameStyle]}>
              <Wordmark size={L.wordmarkSize} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  lockup: {
    width: L.markSize,
    height: L.markSize,
  },
  // Positioned just below the mark and centred on it, so the mark itself never
  // moves until the lift begins.
  name: {
    position: 'absolute',
    top: L.markSize + L.gap,
    left: (L.markSize - WORDMARK_BOX) / 2,
    width: WORDMARK_BOX,
    alignItems: 'center',
  },
});
