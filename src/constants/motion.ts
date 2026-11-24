import { Easing } from 'react-native-reanimated';

/**
 * Shared motion language. The brand mark has four-fold symmetry, so a 90° turn
 * looks identical to the starting frame. That is why the in-page loader can
 * repeat a quarter turn without a visible seam.
 */
export const Motion = {
  /**
   * Quarter-turn easing for the looping loader: slow start, fast sweep, soft ~4°
   * overshoot that settles. This is what gives the rotation its "liquid" feel.
   */
  liquid: Easing.bezier(0.65, 0, 0.2, 1.3),

  /** The loader's mark squashes to this scale at the fastest point of each turn. */
  squash: 0.86,

  /** Ribbon-width swell (in mark units) travelling around the four ribbons. */
  ripple: 9,

  /** Time for one quarter turn in the in-page loader. */
  loaderPeriod: 1200,

  /**
   * One-time launch intro: the mark spins once, the name arrives while the mark
   * lifts to make room for it, then the whole thing fades out.
   */
  launch: {
    /** Must equal `imageWidth` for expo-splash-screen in app.json. */
    markSize: 160,

    /** One full, smooth turn. Ends with a ~2° settle, which reads as liquid. */
    spinDuration: 1000,
    spinEase: Easing.bezier(0.65, 0, 0.25, 1.1),
    /** Mark squashes to this scale at the fastest point of the spin. */
    spinSquash: 0.9,

    /** The lift starts a little before the spin ends so the two flow together. */
    liftDelay: 850,
    liftDuration: 650,
    liftEase: Easing.bezier(0.22, 1, 0.36, 1),

    /** How long the finished lockup stays on screen before leaving. */
    hold: 450,
    fadeDuration: 350,

    wordmarkSize: 36,
    /** Space between the mark and the name. */
    gap: 18,
  },
} as const;
