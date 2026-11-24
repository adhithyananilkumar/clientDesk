import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { kv } from '@/services/local-db';
import { reportError } from '@/services/monitoring';
import { supabase } from '@/services/supabase';
import { useWorkspaceStore } from '@/stores/workspace-store';

const TOKEN_KEY = 'push-token';

/** Show banners while the app is open (the in-app list updates via Realtime too). */
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Ask for permission (once), get this device's Expo push token and attach it
 * to the signed-in account. Silently does nothing where push can't work
 * (simulators, web, Expo Go on Android, no EAS project id).
 */
export async function registerForPush(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable';
  const id = projectId();
  if (!id) return 'unavailable';

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Ticket updates',
        importance: 6, // AndroidImportance.HIGH
        lightColor: '#0A0A0A',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const { error } = await supabase.rpc('register_push_token', {
      device_token: token,
      device_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (error) throw error;
    kv.set(TOKEN_KEY, token);
    return 'granted';
  } catch (error) {
    reportError(error, { where: 'registerForPush' });
    return 'unavailable';
  }
}

type PushData = { url?: string; workspace_id?: string | null; notification_id?: string };

function openFromPush(data: PushData | undefined) {
  if (!data?.url) return;
  if (data.workspace_id) useWorkspaceStore.getState().setCurrent(data.workspace_id);
  if (data.notification_id) {
    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', data.notification_id)
      .then(undefined, () => undefined);
  }
  router.push(data.url as never);
}

/** Registers the device and routes notification taps (warm and cold start). */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    registerForPush();

    const last = Notifications.getLastNotificationResponse();
    if (last) {
      openFromPush(last.notification.request.content.data as PushData);
      Notifications.clearLastNotificationResponse();
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromPush(response.notification.request.content.data as PushData);
    });
    return () => sub.remove();
  }, [enabled]);
}
