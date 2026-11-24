import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LogoMark, Wordmark } from '@/components/brand';
import { LoadingScreen } from '@/components/feedback';
import { Screen, ThemedText } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PREVIEW_MS = 3500;

export function HomeScreen() {
  const theme = useTheme();
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!previewing) return;
    const timer = setTimeout(() => setPreviewing(false), PREVIEW_MS);
    return () => clearTimeout(timer);
  }, [previewing]);

  return (
    <Screen>
      <View style={styles.hero}>
        <LogoMark size={96} />
        <Wordmark size={40} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
          Every issue tracked. Every task assigned. Every resolution recorded.
        </ThemedText>
      </View>

      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPreviewing(true)}
          style={({ pressed }) => [
            styles.devButton,
            { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText type="caption" themeColor="textSecondary">
            Preview loader (dev only)
          </ThemedText>
        </Pressable>
      ) : null}

      {previewing ? <LoadingScreen message="Loading preview" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  tagline: {
    textAlign: 'center',
    maxWidth: 280,
  },
  devButton: {
    alignSelf: 'center',
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
  },
});
