import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, DangerColor, TextField, ThemedText, type TextFieldRef } from '@/components/ui';
import { fieldErrors } from '@/utils/form';
import { signUpSchema } from '@/validation';

import { AuthLayout } from '../components/auth-layout';
import { useAuth } from '../auth-provider';

export function SignUpScreen() {
  const { signUp } = useAuth();
  const emailRef = useRef<TextFieldRef>(null);
  const passwordRef = useRef<TextFieldRef>(null);
  const confirmRef = useRef<TextFieldRef>(null);

  const [values, setValues] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof typeof values) => (text: string) =>
    setValues((previous) => ({ ...previous, [field]: text }));

  async function submit() {
    setFormError(null);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error, needsConfirmation } = await signUp(
      parsed.data.fullName,
      parsed.data.email,
      parsed.data.password,
    );
    setSubmitting(false);
    if (error) setFormError(error);
    else if (needsConfirmation) setConfirmationSentTo(parsed.data.email);
    // Otherwise a session exists and the auth guard moves the user to the greet screen.
  }

  if (confirmationSentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a confirmation link to ${confirmationSentTo}.`}>
        <ThemedText themeColor="textSecondary">
          Open the link on this device, then log in to finish setting up your account.
        </ThemedText>
        <Button title="Back to log in" variant="secondary" onPress={() => router.replace('/sign-in')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up ClientDesk for you and your team."
      footer={
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Already have an account?
          </ThemedText>
          <Link href="/sign-in" replace>
            <ThemedText type="small" style={styles.link}>
              Log in
            </ThemedText>
          </Link>
        </>
      }>
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
      <TextField
        ref={emailRef}
        label="Email"
        value={values.email}
        onChangeText={set('email')}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={values.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
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
      {formError ? (
        <ThemedText type="small" style={styles.error} accessibilityLiveRegion="polite">
          {formError}
        </ThemedText>
      ) : null}
      <Button title="Create account" onPress={submit} loading={submitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: DangerColor },
  link: { fontWeight: '700' },
});
