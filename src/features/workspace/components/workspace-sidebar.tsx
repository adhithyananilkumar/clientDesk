import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand';
import { Avatar, Icon, Pill, ThemedText, type IconName } from '@/components/ui';
import { ROLE } from '@/constants/tickets';
import { Radius, Spacing } from '@/constants/theme';
import { useUnreadCount } from '@/features/notifications/api';
import { useTheme } from '@/hooks/use-theme';
import { useUiStore } from '@/stores/workspace-store';
import { displayName } from '@/utils/format';

import { useMyInvitations, useMyProfile, useWorkspace } from '../api';
import { isAdmin } from '../permissions';

/**
 * Workspace sidebar: switcher, workspace navigation and, at the bottom, the
 * profile button (personal settings live behind it, not in here).
 */
export function WorkspaceSidebar() {
  const open = useUiStore((s) => s.sidebarOpen);
  const close = useUiStore((s) => s.closeSidebar);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { workspace, role, memberships, switchTo } = useWorkspace();
  const profile = useMyProfile().data;
  const unread = useUnreadCount(workspace?.id ?? null).data ?? 0;
  const invitations = useMyInvitations().data?.length ?? 0;
  const [switching, setSwitching] = useState(false);
  const [mounted, setMounted] = useState(open);

  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setMounted(false);
      setSwitching(false);
    }, 220);
    return () => clearTimeout(t);
  }, [open]);

  const go = (href: Href) => {
    close();
    setTimeout(() => router.push(href), 120);
  };

  const nav: { label: string; icon: IconName; href: Href; badge?: number }[] = [
    { label: 'Overview', icon: 'home', href: '/' },
    { label: 'All tickets', icon: 'issue-opened', href: '/tickets' },
    { label: 'Members', icon: 'people', href: '/members' },
    { label: 'Notifications', icon: 'bell', href: '/notifications', badge: unread },
  ];

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      {open ? (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
            <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} onPress={close} accessibilityLabel="Close menu" />
          </Animated.View>
          <Animated.View
            entering={SlideInLeft.springify().damping(24).stiffness(240)}
            exiting={SlideOutLeft.duration(200)}
            style={[styles.panel, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two }]}>
            <View style={styles.brand}>
              <Wordmark size={22} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
              {/* Workspace switcher */}
              <Pressable
                onPress={() => setSwitching((s) => !s)}
                accessibilityRole="button"
                accessibilityLabel={`Current workspace ${workspace?.name}. Switch workspace`}
                style={({ pressed }) => [styles.current, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
                <Avatar name={workspace?.name} uri={workspace?.logo_url} size={40} square />
                <View style={styles.flex}>
                  <ThemedText style={styles.wsName} numberOfLines={1}>
                    {workspace?.name}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    Current workspace
                  </ThemedText>
                </View>
                <Icon name={switching ? 'chevron-up' : 'chevron-down'} size={16} tone="textSecondary" />
              </Pressable>

              {switching ? (
                <Animated.View entering={FadeIn.duration(160)} style={[styles.switcher, { borderColor: theme.border }]}>
                  {memberships.map((m) => {
                    const active = m.workspace.id === workspace?.id;
                    return (
                      <Pressable
                        key={m.workspace.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          switchTo(m.workspace.id);
                          close();
                          router.replace('/');
                        }}
                        style={({ pressed }) => [styles.switchRow, pressed && { backgroundColor: theme.backgroundElement }]}>
                        <Avatar name={m.workspace.name} uri={m.workspace.logo_url} size={28} square />
                        <View style={styles.flex}>
                          <ThemedText style={styles.switchName} numberOfLines={1}>
                            {m.workspace.name}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {ROLE[m.role].label}
                          </ThemedText>
                        </View>
                        {active ? <Icon name="check" size={16} /> : null}
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => go('/workspace/new')}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.switchRow, pressed && { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.plus, { borderColor: theme.borderStrong }]}>
                      <Icon name="plus" size={14} />
                    </View>
                    <ThemedText style={styles.switchName}>Create workspace</ThemedText>
                  </Pressable>
                </Animated.View>
              ) : null}

              <ThemedText type="caption" themeColor="textTertiary" style={styles.sectionLabel}>
                WORKSPACE
              </ThemedText>
              {nav.map((item) => (
                <NavItem key={item.label} {...item} onPress={() => go(item.href)} />
              ))}
              {invitations ? (
                <NavItem label="Invitations" icon="mail" badge={invitations} onPress={() => go('/invitations')} />
              ) : null}
              {isAdmin(role) ? (
                <NavItem label="Workspace settings" icon="gear" onPress={() => go('/workspace/settings')} />
              ) : null}
            </ScrollView>

            {/* Profile button: opens personal account options */}
            <Pressable
              onPress={() => go('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile and account settings"
              style={({ pressed }) => [styles.profile, { borderTopColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
              <Avatar name={displayName(profile)} uri={profile?.avatar_url} size={40} />
              <View style={styles.flex}>
                <ThemedText style={styles.profileName} numberOfLines={1}>
                  {displayName(profile, 'You')}
                </ThemedText>
                {role ? <Pill label={`Workspace ${ROLE[role].label}`} tone={ROLE[role].tone} small /> : null}
              </View>
              <Icon name="chevron-right" size={16} tone="textTertiary" />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}

function NavItem({ label, icon, badge, onPress }: { label: string; icon: IconName; badge?: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      style={({ pressed }) => [styles.nav, { backgroundColor: pressed ? theme.backgroundElement : 'transparent' }]}>
      <Icon name={icon} size={18} />
      <ThemedText style={styles.navLabel}>{label}</ThemedText>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.text }]}>
          <ThemedText style={[styles.badgeText, { color: theme.background }]}>{badge > 99 ? '99+' : badge}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '84%',
    maxWidth: 340,
    borderTopRightRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  brand: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  flex: { flex: 1, gap: 2 },
  current: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: 12, borderRadius: Radius.lg },
  wsName: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  switcher: { marginTop: Spacing.two, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden', paddingVertical: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  switchName: { fontSize: 15, fontWeight: '600' },
  plus: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginTop: Spacing.four, marginBottom: Spacing.one, paddingHorizontal: 12, letterSpacing: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 48, paddingHorizontal: 12, borderRadius: Radius.md },
  navLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  profileName: { fontSize: 15, fontWeight: '700' },
});
