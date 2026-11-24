import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth';

/** Any unknown link goes to the right home for the current auth state, never a dead end. */
export default function NotFound() {
  const { session } = useAuth();
  return <Redirect href={session ? '/' : '/welcome'} />;
}
