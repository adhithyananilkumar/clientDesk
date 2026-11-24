import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, TextField, ThemedText, type TextFieldRef } from '@/components/ui';
import { Spacing } from '@/constants/theme';
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
    // On success the auth guard in the root layout moves the user into the app.
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your ClientDesk workspace.">
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
      <Button title="Sign in" onPress={submit} loading={submitting} />
      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          New to ClientDesk?
        </ThemedText>
        <Link href="/sign-up" replace>
          <ThemedText type="small">Create an account</ThemedText>
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: '#E5484D' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
