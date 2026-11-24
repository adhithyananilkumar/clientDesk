import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from '../ui';
import { Loader } from './loader';

type LoadingScreenProps = {
  message?: string;
};

/** Full-screen loading state: the spinning mark, centred, with an optional message. */
export function LoadingScreen({ message }: LoadingScreenProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={[styles.root, { backgroundColor: theme.background }]}>
      <Loader size={64} label={message ?? 'Loading'} />
      {message ? (
        <ThemedText type="small" themeColor="textSecondary">
          {message}
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
});
