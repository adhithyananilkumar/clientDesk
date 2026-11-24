import { useId } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Motion } from '@/constants/motion';
import { Brand } from '@/constants/theme';
import { useAppearance } from '@/hooks/use-theme';

import { DRAW_ORDER, RIBBONS, STROKE, VIEWBOX, WEAVE_OVERLAY } from './logo-geometry';

/**
 * - `auto`    follows the current light / dark appearance
 * - `onDark`  white ribbons with grey folds, for dark surfaces
 * - `onLight` black ribbons with grey folds, for light surfaces
 * - `white` / `black` flat single-colour versions
 */
export type MarkTone = 'auto' | 'onDark' | 'onLight' | 'white' | 'black';

const GRADIENTS = {
  onDark: { lit: '#FFFFFF', mid: '#E6E6E6', shade: '#6E6E6E' },
  onLight: { lit: Brand.ink, mid: '#2B2B2B', shade: '#9A9A9A' },
} as const;

const FLAT = { white: Brand.white, black: Brand.ink } as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

type RibbonProps = {
  index: number;
  d: string;
  paint: string;
  progress: SharedValue<number>;
  ripple: number;
};

/** One ribbon. Its thickness swells and relaxes in sequence with its neighbours. */
function Ribbon({ index, d, paint, progress, ripple }: RibbonProps) {
  const animatedProps = useAnimatedProps(() => ({
    strokeWidth: STROKE + ripple * Math.sin((progress.get() + index / 4) * Math.PI * 2),
  }));

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={paint}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

export type LogoMarkProps = {
  /** Rendered width and height in dp. */
  size?: number;
  tone?: MarkTone;
  /**
   * Optional 0 → 1 loop (see `useLiquidSpin`). When provided, the four ribbons
   * ripple in sequence as it advances; omit it for a static mark.
   */
  progress?: SharedValue<number>;
  /** Peak ribbon-thickness change while rippling, in mark units. */
  ripple?: number;
  style?: StyleProp<ViewStyle>;
};

export function LogoMark({
  size = 96,
  tone = 'auto',
  progress,
  ripple = Motion.ripple,
  style,
}: LogoMarkProps) {
  const appearance = useAppearance();
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const idle = useSharedValue(0);

  const resolved = tone === 'auto' ? (appearance === 'dark' ? 'onDark' : 'onLight') : tone;
  const palette = resolved === 'onDark' || resolved === 'onLight' ? GRADIENTS[resolved] : null;
  const paintFor = (index: number) =>
    palette ? `url(#${gradientId}${index})` : FLAT[resolved as 'white' | 'black'];

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      pointerEvents="none"
      style={style}>
      {palette ? (
        <Defs>
          {RIBBONS.map(({ index, from, to }) => (
            <LinearGradient
              key={index}
              id={`${gradientId}${index}`}
              gradientUnits="userSpaceOnUse"
              x1={from[0]}
              y1={from[1]}
              x2={to[0]}
              y2={to[1]}>
              <Stop offset="0" stopColor={palette.shade} />
              <Stop offset="0.38" stopColor={palette.mid} />
              <Stop offset="0.6" stopColor={palette.lit} />
              <Stop offset="1" stopColor={palette.lit} />
            </LinearGradient>
          ))}
        </Defs>
      ) : null}

      {DRAW_ORDER.map((index) => (
        <Ribbon
          key={index}
          index={index}
          d={RIBBONS[index].d}
          paint={paintFor(index)}
          progress={progress ?? idle}
          ripple={progress ? ripple : 0}
        />
      ))}
      <Ribbon
        index={WEAVE_OVERLAY.index}
        d={WEAVE_OVERLAY.d}
        paint={paintFor(WEAVE_OVERLAY.index)}
        progress={progress ?? idle}
        ripple={progress ? ripple : 0}
      />
    </Svg>
  );
}
