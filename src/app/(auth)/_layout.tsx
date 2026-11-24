import { Stack } from 'expo-router';

/** Signed-out area: sign in and create account. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
