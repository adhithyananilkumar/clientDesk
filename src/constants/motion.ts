import { Easing } from 'react-native-reanimated';

/**
 * Shared motion language. The brand mark has four-fold symmetry, so a 90° turn
 * looks identical to the starting frame, which is why every loop below rotates a
 * quarter turn and repeats without a visible seam.
 */
export const Motion = {
  /**
   * Quarter-turn easing: slow start, fast sweep, soft ~4° overshoot that settles.
   * This is what gives the rotation its "liquid" feel.
   */
  liquid: Easing.bezier(0.65, 0, 0.2, 1.3),

  /** Mark squashes to this scale at the fastest point of each turn. */
  squash: 0.86,

  /** Ribbon-width swell (in mark units) travelling around the four ribbons. */
  ripple: 9,

  /** Time for one quarter turn in the inline loader. */
  loaderPeriod: 1200,

  launch: {
    /** Must equal `imageWidth` for expo-splash-screen in app.json. */
    markSize: 160,
    /** Time for one quarter turn while the app boots. */
    period: 1250,
    /** Shortest time the launcher stays up once the native splash hands over. */
    minDuration: 1700,
    exitDuration: 640,
    exitReducedDuration: 240,
    /** The mark zooms until its ribbons leave the screen. */
    exitScale: 26,
    exitEase: Easing.bezier(0.7, 0, 0.84, 0),
  },
} as const;
