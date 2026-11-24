import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen } from '@/components/feedback';
import { Button, Icon, ThemedText } from '@/components/ui';
import { Gutter, Spacing } from '@/constants/theme';
import { completeAuthFromUrl } from '@/features/auth/auth-provider';
import { supabase } from '@/services/supabase';

/**
 * Landing route for email confirmation, password recovery and Google sign-in
 * (clientdesk://auth/callback). Exchanges the one-time code for a session,
 * then moves on.
 */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const params = useLocalSearchParams<{ next?: string; type?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    (async () => {
      const result = await completeAuthFromUrl(url);
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (result.error && !data.session) return setError(result.error);
      const recovery = params.next === 'reset' || params.type === 'recovery' || result.type === 'recovery';
      if (recovery && data.session) router.replace({ pathname: '/account/security', params: { recovery: '1' } });
      else router.replace(data.session ? '/' : '/welcome');
    })();
    return () => {
      active = false;
    };
  }, [url, params.next, params.type]);

  if (!error) return <LoadingScreen message="Signing you in" />;

  return (
    <View style={styles.root}>
      <Icon name="alert" size={28} tone="danger" />
      <ThemedText style={styles.title}>That link didn’t work</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {error}
      </ThemedText>
      <Button title="Back to ClientDesk" onPress={() => router.replace('/')} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Gutter, gap: Spacing.two },
  title: { fontSize: 22, fontWeight: '700', marginTop: Spacing.two },
  message: { textAlign: 'center', maxWidth: 320 },
  button: { alignSelf: 'stretch', marginTop: Spacing.four },
});
