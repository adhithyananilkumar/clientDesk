import { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

/**
 * Spring-driven entrance presets for screen content. Springs carry velocity, so
 * pieces glide into place and settle instead of stopping on a hard keyframe.
 * Reanimated skips these automatically when the OS "reduce motion" setting is on.
 */
const SPRING = { damping: 22, stiffness: 180, mass: 0.9 } as const;

/** Rises 16px and fades in. `index` staggers siblings by 60ms each. */
export function riseIn(index = 0) {
  return FadeInDown.withInitialValues({ transform: [{ translateY: 16 }] })
    .delay(80 + index * 60)
    .springify()
    .damping(SPRING.damping)
    .stiffness(SPRING.stiffness)
    .mass(SPRING.mass);
}

/** Soft cross-fade for content that swaps in place (errors, form states). */
export const softFadeIn = FadeIn.duration(220);
export const softFadeOut = FadeOut.duration(160);
