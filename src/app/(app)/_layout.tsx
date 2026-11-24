import { Stack } from 'expo-router';

/** Signed-in area. Navigation (tabs / stacks) for the main product lives here. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
