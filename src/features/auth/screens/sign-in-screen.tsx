import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, DangerColor, TextField, ThemedText, type TextFieldRef } from '@/components/ui';
import { fieldErrors } from '@/utils/form';
import { signInSchema } from '@/validation';

import { AuthLayout } from '../components/auth-layout';
import { useAuth } from '../auth-provider';

export function SignInScreen() {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextFieldRef>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) setFormError(error);
    // On success the auth guard in the root layout moves the user to the greet screen.
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your ClientDesk workspace."
      footer={
        <>
          <ThemedText type="small" themeColor="textSecondary">
            New to ClientDesk?
          </ThemedText>
          <Link href="/sign-up" replace>
            <ThemedText type="small" style={styles.link}>
              Create an account
            </ThemedText>
          </Link>
        </>
      }>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {formError ? (
        <ThemedText type="small" style={styles.error} accessibilityLiveRegion="polite">
          {formError}
        </ThemedText>
      ) : null}
      <Button title="Log in" onPress={submit} loading={submitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: DangerColor },
  link: { fontWeight: '700' },
});
