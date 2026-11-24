import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark, Wordmark } from '@/components/brand';
import { LoadingScreen } from '@/components/feedback';
import { Button, Screen, ThemedText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';

const PREVIEW_MS = 3500;

export function HomeScreen() {
  const { user, signOut } = useAuth();
  const [previewing, setPreviewing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!previewing) return;
    const timer = setTimeout(() => setPreviewing(false), PREVIEW_MS);
    return () => clearTimeout(timer);
  }, [previewing]);

  const name = (user?.user_metadata?.full_name as string | undefined) || user?.email || 'there';

  return (
    <Screen>
      <View style={styles.hero}>
        <LogoMark size={96} />
        <Wordmark size={40} />
        <ThemedText themeColor="textSecondary" style={styles.greeting}>
          Signed in as {name}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        {__DEV__ ? (
          <Button title="Preview loader" variant="ghost" onPress={() => setPreviewing(true)} />
        ) : null}
        <Button
          title="Sign out"
          variant="ghost"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
        />
      </View>

      {previewing ? <LoadingScreen message="Loading preview" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  greeting: { textAlign: 'center', maxWidth: 280 },
  actions: { gap: Spacing.two, paddingBottom: Spacing.four },
});
