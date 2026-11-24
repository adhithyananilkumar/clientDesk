import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon, ThemedText, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
import { useUiStore } from '@/stores/workspace-store';
import { displayName } from '@/utils/format';

import { useMyProfile } from '../api';

/** Avatar button for the top right of a screen; opens the profile drawer. */
export function ProfileButton() {
  const open = useUiStore((s) => s.openProfile);
  const profile = useMyProfile().data;
  const { user } = useAuth();
  const name = displayName(profile ?? { full_name: user?.user_metadata?.full_name as string, email: user?.email }, '?');
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={6}>
      <Avatar size={40} name={name} uri={profile?.avatar_url} />
    </Pressable>
  );
}

/** Right-hand drawer: who you are, settings, help and sign out. */
export function ProfileDrawer() {
  const open = useUiStore((s) => s.profileOpen);
  const close = useUiStore((s) => s.closeProfile);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const profile = useMyProfile().data;
  const [mounted, setMounted] = useState(open);
  const [signingOut, setSigningOut] = useState(false);
  const name = displayName(profile ?? { full_name: user?.user_metadata?.full_name as string, email: user?.email }, 'You');

  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  const go = (href: Href) => {
    close();
    setTimeout(() => router.push(href), 120);
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Offline drafts and cached tickets on this device will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          close();
          await signOut();
        },
      },
    ]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {open ? (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
            <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} onPress={close} accessibilityLabel="Close profile" />
          </Animated.View>
          <Animated.View
            entering={SlideInRight.duration(280).easing(Easing.out(Easing.cubic))}
            exiting={SlideOutRight.duration(220).easing(Easing.in(Easing.cubic))}
            style={[styles.panel, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two }]}>
            <ScrollView contentContainerStyle={styles.scroll}>
              <View style={styles.head}>
                <Avatar size={72} name={name} uri={profile?.avatar_url} />
                <ThemedText style={styles.name} numberOfLines={1}>
                  {name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.regular}>
                  {profile?.email ?? user?.email}
                </ThemedText>
              </View>

              <Item icon="person" label="My profile" onPress={() => go('/account/profile')} />
              <Item icon="gear" label="Settings" onPress={() => go('/account/settings')} />
              <Item icon="question" label="Help & support" onPress={() => go('/account/help')} />
            </ScrollView>

            <View style={styles.appearance}>
              <ThemeSwitcher />
            </View>

            <Pressable
              onPress={confirmSignOut}
              disabled={signingOut}
              accessibilityRole="button"
              style={({ pressed }) => [styles.signOut, { borderTopColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
              <Icon name="sign-out" size={18} tone="danger" />
              <ThemedText style={[styles.itemLabel, { color: theme.danger }]}>Sign out</ThemedText>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

function Item({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.item, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      <Icon name={icon} size={18} />
      <ThemedText style={styles.itemLabel}>{label}</ThemedText>
      <Icon name="chevron-right" size={16} tone="textTertiary" />
    </Pressable>
  );
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Auto', icon: 'device-mobile' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

/** Segmented Auto / Light / Dark control with icons. */
function ThemeSwitcher() {
  const theme = useTheme();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
      {THEME_OPTIONS.map((o) => {
        const active = mode === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => setMode(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label} theme`}
            style={[styles.segmentItem, active && { backgroundColor: theme.background }]}>
            <Icon name={o.icon} size={16} tone={active ? 'text' : 'textTertiary'} />
            <ThemedText type="small" style={[styles.segmentLabel, { color: active ? theme.text : theme.textSecondary }]}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  appearance: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.md, gap: 4, marginHorizontal: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: Radius.sm },
  segmentLabel: { fontWeight: '600' },
  root: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '84%',
    maxWidth: 340,
    borderTopLeftRadius: Radius.xl,
    borderBottomLeftRadius: Radius.xl,
  },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  head: { alignItems: 'center', gap: 4, paddingVertical: Spacing.four },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '700', marginTop: Spacing.two },
  regular: { fontWeight: '400', marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 50, paddingHorizontal: 12, borderRadius: Radius.md },
  itemLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  signOut: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
});
