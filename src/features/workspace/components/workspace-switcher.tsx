import { router, type Href } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Icon, ThemedText, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toast } from '@/stores/toast-store';

import { useMyInvitations, useWorkspace } from '../api';

/** Workspace pill that opens a dropdown (not a sidebar) anchored beneath it. */
export function WorkspaceSwitcher() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { workspace, memberships, switchTo } = useWorkspace();
  const invitations = useMyInvitations().data?.length ?? 0;
  const ref = useRef<ComponentRef<typeof Pressable>>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number }>({ x: Spacing.three, y: insets.top + 56 });

  const show = () => {
    ref.current?.measureInWindow((x, y, _w, h) => {
      setAnchor({ x: Math.max(x, Spacing.two), y: y + h + 6 });
      setOpen(true);
    });
  };
  const close = () => setOpen(false);
  const go = (href: Href) => {
    close();
    setTimeout(() => router.push(href), 80);
  };

  return (
    <>
      <Pressable
        ref={ref}
        collapsable={false}
        onPress={show}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Workspace ${workspace?.name}. Switch workspace`}
        style={({ pressed }) => [styles.pill, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
        <Avatar name={workspace?.name} uri={workspace?.logo_url} size={28} square />
        <View style={styles.pillText}>
          <ThemedText style={styles.wsName} numberOfLines={1}>
            {workspace?.name}
          </ThemedText>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} tone="textSecondary" />
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} onPress={close} accessibilityLabel="Close workspace menu" />
        </Animated.View>
        <Animated.View
          entering={FadeIn.duration(160).easing(Easing.out(Easing.cubic))}
          style={[styles.menu, { top: anchor.y, left: anchor.x, backgroundColor: theme.background, borderColor: theme.border }]}>
          <ScrollView bounces={false} style={styles.scroll} showsVerticalScrollIndicator={false}>
            {memberships.map((m) => {
              const active = m.workspace.id === workspace?.id;
              return (
                <Pressable
                  key={m.workspace.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={m.workspace.name}
                  onPress={() => {
                    if (!active) {
                      switchTo(m.workspace.id);
                      toast.show(`Switched to ${m.workspace.name}`);
                      router.replace('/');
                    }
                    close();
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
                  <Avatar name={m.workspace.name} uri={m.workspace.logo_url} size={28} square />
                  <ThemedText style={styles.rowText} numberOfLines={1}>
                    {m.workspace.name}
                  </ThemedText>
                  {active ? <Icon name="check" size={16} /> : null}
                </Pressable>
              );
            })}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            {invitations ? <MenuRow icon="mail" label={`Invitations (${invitations})`} onPress={() => go('/invitations')} /> : null}
            <MenuRow icon="organization" label="All workspaces" onPress={() => go('/workspaces')} />
            <MenuRow icon="plus" label="Create workspace" onPress={() => go('/workspace/new')} />
          </ScrollView>
        </Animated.View>
      </Modal>
    </>
  );
}

function MenuRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.iconSlot}>
        <Icon name={icon} size={16} />
      </View>
      <ThemedText style={styles.rowText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 6, paddingRight: 14, height: 44, borderRadius: Radius.pill, flexShrink: 1 },
  pillText: { flexShrink: 1 },
  wsName: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  menu: {
    position: 'absolute',
    width: 300,
    maxWidth: '92%',
    maxHeight: '70%',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  rowText: { flex: 1, fontSize: 15, fontWeight: '600' },
  iconSlot: { width: 28, alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
});
