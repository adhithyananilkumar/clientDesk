import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedView } from './themed-view';

type ScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Standard screen container: themed background, safe-area insets, centred max width. */
export function Screen({ children, style }: ScreenProps) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={[styles.content, style]}>{children}</SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
});
