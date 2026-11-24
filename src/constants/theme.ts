/**
 * Design tokens for ClientDesk. Dark-first, near-black surfaces with a neutral
 * grey scale that matches the brand mark. Light mode mirrors the same hierarchy.
 */

export const Brand = {
  ink: '#0A0A0A',
  white: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    text: Brand.ink,
    textSecondary: '#6B6B6B',
    background: Brand.white,
    backgroundElement: '#F4F4F5',
    backgroundSelected: '#E4E4E7',
    border: '#E4E4E7',
  },
  dark: {
    text: Brand.white,
    textSecondary: '#A3A3A3',
    background: Brand.ink,
    backgroundElement: '#161616',
    backgroundSelected: '#232323',
    border: '#262626',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  /** Fully rounded ends for buttons and fields. */
  pill: 999,
} as const;

export const MaxContentWidth = 800;
