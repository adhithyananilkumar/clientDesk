import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** True while the device has a usable connection (shared with TanStack Query). */
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
