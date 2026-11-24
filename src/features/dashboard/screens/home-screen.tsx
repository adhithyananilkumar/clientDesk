import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LogoMark } from '@/components/brand';
import { Button, Screen, ThemedText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';

function greetingFor(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Landing screen after sign-in: a time-of-day greeting with the user's first name. */
export function HomeScreen() {
  const { user, signOut } = useAuth();
  const theme = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const firstName = fullName ? fullName.split(/\s+/)[0] : (user?.email?.split('@')[0] ?? 'there');
  const initial = firstName.charAt(0).toUpperCase();
  const greeting = greetingFor(new Date().getHours());

  return (
    <Screen>
      <View style={styles.topBar}>
        <LogoMark size={32} />
        <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={styles.avatarText}>{initial}</ThemedText>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
        <ThemedText themeColor="textSecondary" style={styles.greeting}>
          {greeting},
        </ThemedText>
        <ThemedText style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
          {firstName}
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(120).duration(500)}
        style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.cardTitle}>You&apos;re all set</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your workspace is ready. Tickets and clients will show up here.
        </ThemedText>
      </Animated.View>

      <View style={styles.actions}>
        <Button
          title="Log out"
          variant="secondary"
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  hero: { flex: 1, justifyContent: 'center', gap: Spacing.one },
  greeting: { fontSize: 22, lineHeight: 28, fontWeight: '500' },
  name: { fontSize: 52, lineHeight: 58, fontWeight: '700', letterSpacing: -1.5 },
  card: { borderRadius: Radius.md, padding: Spacing.four, gap: Spacing.one, marginBottom: Spacing.four },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  actions: { paddingBottom: Spacing.four },
});
