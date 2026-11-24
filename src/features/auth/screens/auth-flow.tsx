import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Screen } from '@/components/ui';
import { riseIn } from '@/constants/motion-presets';

import { AuthForm, type FormMode } from '../components/auth-form';
import { IntroPanel } from '../components/intro-panel';

type Step = 'intro' | FormMode;

/** Smooth ease-out with no overshoot: things arrive and stop, nothing wobbles. */
const EASE = Easing.out(Easing.cubic);

/**
 * The whole signed-out experience on one screen: welcome, log in and create
 * account. Nothing navigates, so there are no page transitions to jerk:
 * - welcome ↔ form: the content fades out, swaps, and floats back in.
 * - log in ↔ create account: the form reshapes itself in place.
 * Android back returns from a form to welcome.
 */
export function AuthFlow({ initial = 'intro' }: { initial?: Step }) {
  const [step, setStep] = useState<Step>(initial);
  const isIntro = step === 'intro';

  const panelOpacity = useSharedValue(1);
  const panelY = useSharedValue(0);

  const go = useCallback(
    (next: Step) => {
      if (next === step) return;
      // Between the two forms there is no swap: the form reshapes itself.
      if (next !== 'intro' && step !== 'intro') return setStep(next);
      Keyboard.dismiss();
      panelY.set(withTiming(-8, { duration: 150 }));
      panelOpacity.set(
        withTiming(0, { duration: 150 }, (finished) => {
          if (finished) scheduleOnRN(setStep, next);
        }),
      );
    },
    [step, panelOpacity, panelY],
  );

  // After a swap commits, float the new content in from just below.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    panelY.set(12);
    panelY.set(withTiming(0, { duration: 280, easing: EASE }));
    panelOpacity.set(withTiming(1, { duration: 240, easing: EASE }));
  }, [isIntro, panelOpacity, panelY]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.get(),
    transform: [{ translateY: panelY.get() }],
  }));

  useEffect(() => {
    if (isIntro) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      go('intro');
      return true;
    });
    return () => sub.remove();
  }, [isIntro, go]);

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isIntro}>
          {/* Outer view: first-load entrance. Inner view: the welcome ↔ form swap. */}
          <Animated.View entering={riseIn(0)} style={styles.flex}>
            <Animated.View style={[styles.flex, panelStyle]}>
              {isIntro ? (
                <IntroPanel onSignIn={() => go('sign-in')} onSignUp={() => go('sign-up')} />
              ) : (
                <AuthForm mode={step} onModeChange={go} />
              )}
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
});
