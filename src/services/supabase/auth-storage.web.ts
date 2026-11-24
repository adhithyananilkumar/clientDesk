import type { SupportedStorage } from '@supabase/supabase-js';

/** On the web the browser's own storage is used (and nothing during server rendering). */
export const authStorage: SupportedStorage | undefined =
  typeof window === 'undefined' ? undefined : window.localStorage;
