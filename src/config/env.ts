/**
 * Typed, validated access to build-time environment variables.
 *
 * Expo only inlines `process.env.EXPO_PUBLIC_*` when written out literally, so each
 * variable is read by name here and checked once at startup. Import `env` instead of
 * reading `process.env` anywhere else.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.startsWith('YOUR-') || value.includes('xxxx')) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local, fill it in, ` +
        'then restart Metro with `npx expo start -c`.',
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  /** Optional: crash reporting. */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
} as const;
