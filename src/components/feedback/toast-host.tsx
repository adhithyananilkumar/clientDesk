import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Gutter, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToastStore } from '@/stores/toast-store';

import { Icon } from '../ui/icon';
import { ThemedText } from '../ui/themed-text';

/** Single floating toast at the top. Inverted colours so it reads on any screen. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!toast) return null;
  const icon = toast.tone === 'success' ? 'check-circle' : toast.tone === 'danger' ? 'alert' : 'info';
  const iconColor = toast.tone === 'success' ? theme.success : toast.tone === 'danger' ? theme.danger : theme.background;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + Spacing.two }]}>
      <Animated.View key={toast.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Pressable
          onPress={hide}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { backgroundColor: theme.text }]}>
          <Icon name={icon} size={16} color={iconColor} />
          <ThemedText style={[styles.text, { color: theme.background }]} numberOfLines={3}>
            {toast.message}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Gutter, right: Gutter, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingVertical: 14,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: Radius.lg,
    maxWidth: 520,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { fontSize: 15, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
});
