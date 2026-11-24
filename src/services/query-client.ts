import { dehydrate, hydrate, onlineManager, QueryClient, type DehydratedState, type Query } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

import { kv } from './local-db';

const CACHE_KEY = 'query-cache.v1';
/** Keep cached screens readable offline for a week. */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: MAX_AGE,
      // Serve cached data first; fetch when the network allows.
      networkMode: 'offlineFirst',
      retry: (count, error) => count < 2 && !isPermissionError(error),
      refetchOnWindowFocus: true,
    },
    mutations: { networkMode: 'online', retry: 0 },
  },
});

function isPermissionError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === '42501' || code === 'PGRST301' || code === 'PGRST116';
}

// Connectivity: TanStack pauses queries/mutations while offline.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) => {
    Network.getNetworkStateAsync()
      .then((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false))
      .catch(() => undefined);
    const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false));
    return () => sub.remove();
  });
}

/** Only successful, workspace-scoped reads are written to disk. */
function shouldPersist(query: Query) {
  return query.state.status === 'success' && query.meta?.persist !== false && query.queryKey[0] === 'ws';
}

/** Restore the last snapshot synchronously, before the first render. */
export function restoreQueryCache() {
  const snapshot = kv.get<{ savedAt: number; state: DehydratedState }>(CACHE_KEY);
  if (!snapshot || Date.now() - snapshot.savedAt > MAX_AGE) return;
  try {
    hydrate(queryClient, snapshot.state);
  } catch {
    kv.remove(CACHE_KEY);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let subscribed = false;

/** Debounced snapshot of the cache on every change. */
export function startPersistingQueryCache() {
  if (subscribed) return;
  subscribed = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' && event.type !== 'removed') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersist });
        kv.set(CACHE_KEY, { savedAt: Date.now(), state });
      } catch {
        // Best effort.
      }
    }, 1000);
  });
}

/** On sign-out: nothing from the previous account stays on the device. */
export function clearQueryCache() {
  clearTimeout(saveTimer);
  queryClient.clear();
  kv.remove(CACHE_KEY);
}
