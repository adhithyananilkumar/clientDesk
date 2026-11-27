/**
 * Design tokens for ClientDesk.
 *
 * The base is monochrome and confident (ink on white, white on near-black),
 * like a ride-hailing app: big type, solid black actions, quiet grey fills.
 * Meaning is carried by a small semantic palette borrowed from GitHub's
 * Primer colours, so status and priority read instantly.
 */

export const Brand = {
  ink: '#0A0A0A',
  white: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    text: Brand.ink,
    textSecondary: '#5E5E5E',
    textTertiary: '#6B6B6B', // 4.8:1 on backgroundElement (WCAG AA)
    background: Brand.white,
    backgroundElement: '#F3F3F3',
    backgroundSelected: '#E6E6E6',
    surface: Brand.white,
    border: '#E8E8E8',
    borderStrong: '#D0D0D0',
    overlay: 'rgba(0,0,0,0.45)',
    link: '#0969DA',

    success: '#1A7F37', // 4.6:1 on successSoft
    successSoft: '#DAFBE1',
    warning: '#9A6700',
    warningSoft: '#FFF8C5',
    danger: '#CF222E',
    dangerSoft: '#FFEBE9',
    done: '#8250DF',
    doneSoft: '#FBEFFF',
    info: '#0969DA',
    infoSoft: '#DDF4FF',
    attention: '#BC4C00',
    attentionSoft: '#FFF1E5',
    neutral: '#59636E',
    neutralSoft: '#EFF2F5',
  },
  dark: {
    text: Brand.white,
    textSecondary: '#A8A8A8',
    textTertiary: '#8C8C8C', // 5.3:1 on backgroundElement (WCAG AA)
    background: Brand.ink,
    backgroundElement: '#171717',
    backgroundSelected: '#242424',
    surface: '#111111',
    border: '#242424',
    borderStrong: '#363636',
    overlay: 'rgba(0,0,0,0.6)',
    link: '#4493F8',

    success: '#3FB950',
    successSoft: 'rgba(46,160,67,0.16)',
    warning: '#D29922',
    warningSoft: 'rgba(187,128,9,0.16)',
    danger: '#F85149',
    dangerSoft: 'rgba(248,81,73,0.14)',
    done: '#A371F7',
    doneSoft: 'rgba(163,113,247,0.16)',
    info: '#4493F8',
    infoSoft: 'rgba(56,139,253,0.15)',
    attention: '#DB6D28',
    attentionSoft: 'rgba(219,109,40,0.16)',
    neutral: '#9198A1',
    neutralSoft: 'rgba(145,152,161,0.14)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Palette = { [K in ThemeColor]: string };

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  /** Fully rounded ends for buttons and fields. */
  pill: 999,
} as const;

/** Horizontal screen padding. */
export const Gutter = 20;

export const MaxContentWidth = 800;
