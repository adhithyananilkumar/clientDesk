import AntDesign from '@expo/vector-icons/AntDesign';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Button, DangerColor, TextField, ThemedText, type TextFieldRef } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fieldErrors } from '@/utils/form';
import { signInSchema, signUpSchema } from '@/validation';

import { useAuth } from '../auth-provider';
import { TurningMark } from './turning-mark';

export type FormMode = 'sign-in' | 'sign-up';

/**
 * Siblings glide to their new spot when a field appears or disappears, so
 * switching between log in and create account reshapes the form in place
 * instead of swapping pages.
 */
const layout = LinearTransition.duration(280).easing(Easing.out(Easing.cubic));
const grow = FadeIn.duration(220).delay(60);
const shrink = FadeOut.duration(120);
const swapText = FadeIn.duration(260);

/** Space above the mark: generous for the short log-in form, tighter for create account. */
const MARK_TOP: Record<FormMode, number> = {
  'sign-in': Spacing.six + Spacing.four,
  'sign-up': Spacing.four,
};

const COPY = {
  'sign-in': {
    title: 'Welcome back',
    subtitle: 'Log in to your ClientDesk workspace.',
    action: 'Log in',
    prompt: 'New to ClientDesk?',
    switchLabel: 'Create an account',
  },
  'sign-up': {
    title: 'Create your account',
    subtitle: 'Set up ClientDesk for you and your team.',
    action: 'Create account',
    prompt: 'Already have an account?',
    switchLabel: 'Log in',
  },
} as const;

type AuthFormProps = {
  mode: FormMode;
  onModeChange: (mode: FormMode) => void;
};

/** One form for both log in and create account. Email and password carry over when switching. */
export function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const { signIn, signUp, signInWithGoogle, resendConfirmation } = useAuth();
  const theme = useTheme();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);
  const confirmRef = useRef<TextFieldRef>(null);

  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turns, setTurns] = useState(0);

  const signingUp = mode === 'sign-up';
  const copy = COPY[mode];

  // Errors belong to the form you were filling in; start clean after a switch.
  const switchMode = (next: FormMode) => {
    setErrors({});
    setFormError(null);
    setTurns((t) => t + 1);
    onModeChange(next);
  };

  const set = (field: keyof typeof values) => (text: string) =>
    setValues((previous) => ({ ...previous, [field]: text }));

  async function submit() {
    setFormError(null);
    if (signingUp) {
      const parsed = signUpSchema.safeParse(values);
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      setErrors({});
      setSubmitting(true);
      const { error, needsConfirmation } = await signUp(parsed.data.fullName, parsed.data.email, parsed.data.password);
      setSubmitting(false);
      if (error) setFormError(error);
      else if (needsConfirmation) setConfirmationSentTo(parsed.data.email);
    } else {
      const parsed = signInSchema.safeParse({ email: values.email, password: values.password });
      if (!parsed.success) return setErrors(fieldErrors(parsed.error));
      setErrors({});
      setSubmitting(true);
      const { error } = await signIn(parsed.data.email, parsed.data.password);
      setSubmitting(false);
      if (error) setFormError(error);
    }
    // On success the auth guard in the root layout takes the user into the app.
  }

  if (confirmationSentTo) {
    return (
      <Animated.View entering={swapText} style={styles.root}>
        <View style={[styles.markRow, { marginTop: MARK_TOP['sign-in'] }]}>
          <TurningMark turns={turns} size={64} />
        </View>
        <View style={styles.heading}>
          <ThemedText style={styles.title}>Check your inbox</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            We sent a confirmation link to {confirmationSentTo}. Open it on this device, then log in.
          </ThemedText>
        </View>
        <Button
          title={resent ? 'Email sent again' : 'Resend email'}
          variant="ghost"
          disabled={resent}
          style={styles.resend}
          onPress={async () => {
            const { error } = await resendConfirmation(confirmationSentTo);
            if (!error) setResent(true);
          }}
        />
        <Button
          title="Back to log in"
          variant="secondary"
          onPress={() => {
            setConfirmationSentTo(null);
            switchMode('sign-in');
          }}
        />
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Lower for log in, higher for the longer create-account form. It glides
          with the same easing as the fields, so the whole column moves as one. */}
      <Animated.View layout={layout} style={[styles.markRow, { marginTop: MARK_TOP[mode] }]}>
        <TurningMark turns={turns} size={64} />
      </Animated.View>

      {/* Keyed by mode so the new heading fades in where the old one was. */}
      <Animated.View key={mode} entering={swapText} layout={layout} style={styles.heading}>
        <ThemedText style={styles.title}>{copy.title}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {copy.subtitle}
        </ThemedText>
      </Animated.View>

      <View style={styles.form}>
        {signingUp ? (
          <Animated.View entering={grow} exiting={shrink} layout={layout}>
            <TextField
              label="Full name"
              value={values.fullName}
              onChangeText={set('fullName')}
              error={errors.fullName}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </Animated.View>
        ) : null}

        <Animated.View layout={layout}>
          <TextField
            ref={emailRef}
            label="Email"
            value={values.email}
            onChangeText={set('email')}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType={signingUp ? 'emailAddress' : 'username'}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </Animated.View>

        <Animated.View layout={layout}>
          <TextField
            ref={passwordRef}
            label="Password"
            value={values.password}
            onChangeText={set('password')}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            textContentType={signingUp ? 'newPassword' : 'password'}
            returnKeyType={signingUp ? 'next' : 'go'}
            onSubmitEditing={signingUp ? () => confirmRef.current?.focus() : submit}
          />
        </Animated.View>

        {signingUp ? (
          <Animated.View entering={grow} exiting={shrink} layout={layout}>
            <TextField
              ref={confirmRef}
              label="Confirm password"
              value={values.confirmPassword}
              onChangeText={set('confirmPassword')}
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </Animated.View>
        ) : null}

        {formError ? (
          <Animated.View entering={grow} exiting={shrink} layout={layout}>
            <ThemedText type="small" style={styles.error} accessibilityLiveRegion="polite">
              {formError}
            </ThemedText>
          </Animated.View>
        ) : null}

        {!signingUp ? (
          <Animated.View entering={grow} exiting={shrink} layout={layout} style={styles.forgotRow}>
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => router.push({ pathname: '/forgot-password', params: { email: values.email } })}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
                Forgot password?
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View layout={layout}>
          <Button title={copy.action} onPress={submit} loading={submitting} />
        </Animated.View>

        <Animated.View layout={layout} style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <ThemedText type="caption" themeColor="textSecondary">
            OR
          </ThemedText>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </Animated.View>

        <Animated.View layout={layout}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={googleBusy}
            onPress={async () => {
              setFormError(null);
              setGoogleBusy(true);
              const { error } = await signInWithGoogle();
              setGoogleBusy(false);
              if (error) setFormError(error);
            }}
            style={({ pressed }) => [
              styles.google,
              { borderColor: theme.borderStrong, opacity: googleBusy ? 0.5 : pressed ? 0.85 : 1 },
            ]}>
            <AntDesign name="google" size={18} color={theme.text} />
            <ThemedText style={styles.googleText}>{googleBusy ? 'Opening Google…' : 'Continue with Google'}</ThemedText>
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View layout={layout} style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {copy.prompt}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => switchMode(signingUp ? 'sign-in' : 'sign-up')}>
          <ThemedText type="small" style={styles.link}>
            {copy.switchLabel}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  markRow: { alignItems: 'flex-start', marginBottom: Spacing.four },
  heading: { gap: Spacing.two, marginBottom: Spacing.five },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 16, lineHeight: 22 },
  form: { gap: Spacing.four - Spacing.one },
  error: { color: DangerColor },
  link: { fontWeight: '700' },
  resend: { marginBottom: Spacing.three },
  forgotRow: { alignItems: 'flex-end', marginTop: -Spacing.two },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  google: {
    minHeight: 56,
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two + 2,
  },
  googleText: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: 'auto',
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
  },
});
