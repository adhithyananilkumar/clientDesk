import * as SplashScreen from 'expo-splash-screen';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Motion } from '@/constants/motion';
import { useLiquidSpin } from '@/hooks/use-liquid-spin';
import { useTheme } from '@/hooks/use-theme';

import { LogoMark } from '../brand';

// Keep the native splash up until the first frame of the launcher is on screen,
// so there is never a blank flash between the two.
SplashScreen.preventAutoHideAsync().catch(() => {});

type AppLauncherProps = {
  children: ReactNode;
  /**
   * Flip to `true` once the app has what it needs to show real content (restored
   * session, loaded fonts, ...). The launcher then plays its exit. Defaults to `true`,
   * in which case only `minDuration` keeps it up.
   */
  ready?: boolean;
  /** Shortest time the launcher stays visible, so the animation is never cut off. */
  minDuration?: number;
};

/**
 * Animated app launch sequence.
 *
 * 1. The native splash (static mark, same size and colours) hands over to this
 *    overlay with no visible change.
 * 2. The mark starts its liquid quarter-turn loop while the app boots underneath.
 * 3. Once the app is ready and `minDuration` has passed, the mark zooms
 *    through the camera and the overlay fades out, revealing the app.
 */
export function AppLauncher({
  children,
  ready = true,
  minDuration = Motion.launch.minDuration,
}: AppLauncherProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { progress, style: spinStyle } = useLiquidSpin({ period: Motion.launch.period });

  const exit = useSharedValue(0);
  const [visible, setVisible] = useState(true);
  const [handedOver, setHandedOver] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);

  const handleLayout = useCallback(() => {
    if (handedOver) return;
    setHandedOver(true);
    SplashScreen.hideAsync().catch(() => {});
  }, [handedOver]);

  // The minimum display time only starts counting once the user can actually see us.
  useEffect(() => {
    if (!handedOver) return;
    const timer = setTimeout(() => setMinElapsed(true), minDuration);
    return () => clearTimeout(timer);
  }, [handedOver, minDuration]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    exit.set(
      withTiming(
        1,
        {
          duration: reduceMotion ? Motion.launch.exitReducedDuration : Motion.launch.exitDuration,
          easing: reduceMotion ? undefined : Motion.launch.exitEase,
        },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(setVisible, false);
        },
      ),
    );
  }, [ready, minElapsed, reduceMotion, exit]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.get(), [0, reduceMotion ? 0 : 0.4, 1], [1, 1, 0], Extrapolation.CLAMP),
  }));

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(exit.get(), [0, 1], [1, reduceMotion ? 1 : Motion.launch.exitScale]) },
    ],
  }));

  return (
    <View style={styles.root}>
      {children}
      {visible ? (
        <Animated.View
          onLayout={handleLayout}
          style={[styles.overlay, { backgroundColor: theme.background }, overlayStyle]}>
          <Animated.View style={zoomStyle}>
            <Animated.View style={spinStyle}>
              <LogoMark size={Motion.launch.markSize} progress={progress} />
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
});
