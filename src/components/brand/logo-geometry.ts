/**
 * Geometry of the ClientDesk mark: four ribbons joined tip-to-tip around a
 * hollow centre, drawn in a 1024 × 1024 box (identical to the brand master art).
 *
 * Each ribbon is a quadratic curve drawn as a thick, round-capped stroke. The
 * last ribbon is repeated on top of the first to produce the over/under weave.
 */

type Point = readonly [x: number, y: number];

export const VIEWBOX = 1024;
/** Nominal ribbon thickness. */
export const STROKE = 190;

const CENTER = VIEWBOX / 2;
/** Distance from the centre to each tip. */
const REACH = 407;
/** How far each ribbon bows inwards (0 = straight line, 1 = through the centre). */
const CURVE = 0.55;
/** Where along the last ribbon the weave overlay begins. */
const WEAVE_SPLIT = 0.55;

const fmt = ([x, y]: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;
const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

const TIPS: readonly Point[] = [
  [CENTER, CENTER - REACH],
  [CENTER + REACH, CENTER],
  [CENTER, CENTER + REACH],
  [CENTER - REACH, CENTER],
];

function controlPoint(from: Point, to: Point): Point {
  const mid = lerp(from, to, 0.5);
  return [CENTER + (mid[0] - CENTER) * CURVE, CENTER + (mid[1] - CENTER) * CURVE];
}

export type Ribbon = {
  index: number;
  from: Point;
  to: Point;
  /** SVG path data. */
  d: string;
};

export const RIBBONS: readonly Ribbon[] = TIPS.map((from, index) => {
  const to = TIPS[(index + 1) % TIPS.length];
  return { index, from, to, d: `M${fmt(from)} Q${fmt(controlPoint(from, to))} ${fmt(to)}` };
});

/** Back-to-front paint order. */
export const DRAW_ORDER = [3, 2, 1, 0] as const;

/** Tail of the last ribbon, repainted on top of the first. */
export const WEAVE_OVERLAY: Pick<Ribbon, 'index' | 'd'> = (() => {
  const { from, to } = RIBBONS[3];
  const control = controlPoint(from, to);
  const a = lerp(from, control, WEAVE_SPLIT);
  const b = lerp(control, to, WEAVE_SPLIT);
  return { index: 3, d: `M${fmt(lerp(a, b, WEAVE_SPLIT))} Q${fmt(b)} ${fmt(to)}` };
})();
