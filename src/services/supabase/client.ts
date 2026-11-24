import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/config';

import { authStorage } from './auth-storage';

/**
 * The one Supabase client for the whole app.
 *
 * Only the public (publishable) key lives in the app; what a signed-in user can
 * read or change is decided by Row Level Security in the database. Never put a
 * service-role key in this project.
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no browser URL to read a session from in a native app.
    detectSessionInUrl: false,
    // PKCE: email links and OAuth return a one-time code exchanged on this device.
    flowType: 'pkce',
  },
});

// Refresh tokens only while the app is in the foreground. Registered once.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
