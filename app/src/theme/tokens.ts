// Code-ready design tokens for Lola — ported verbatim from the design handoff
// `theme/tokens.json`. Two surfaces: `dad` (low-vision, Spanish, AAA contrast,
// huge targets) and `caregiver` (normal density, English).
//
// Keep this file the single source of truth for color / spacing / type so
// screens never hardcode hex. If the design bundle updates tokens.json, mirror
// the change here.

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const color = {
  primary: {
    50: '#EAF2FE',
    100: '#D2E3FC',
    200: '#A9C7F7',
    500: '#1A73E8',
    600: '#1565D8',
    700: '#1557B0',
    disabled: '#C2CAD6',
  },
  neutral: {
    white: '#FFFFFF',
    canvas: '#F6F7F9',
    sunken: '#EDF0F4',
    border: '#E0E4EA',
    300: '#CBD2DB',
    ink: '#0C0D0F',
  },
  text: {
    high: '#1B1E24',
    medium: '#5C6470',
    low: '#8A929E',
    onPrimary: '#FFFFFF',
    onDark: '#FFFFFF',
    link: '#1A73E8',
  },
  status: {
    success: '#1E9E5A',
    successBg: '#E6F6EC',
    warn: '#B9740A',
    warnBg: '#FCF1DD',
    error: '#D92D20',
    errorPressed: '#B42318',
    errorBg: '#FDECEA',
  },
  dad: {
    describeBg: '#FFFFFF',
    describeFg: '#0C0D0F',
    describeAccent: '#1A73E8',
    askBg: '#0C0D0F',
    askFg: '#FFFFFF',
    askAccent: '#5AA2F5',
  },
  // Calm heads-up amber used by the Home error states (per handoff §3).
  heedAmber: '#F0B45C',
} as const;

// 4-based spacing scale (key === multiple of 4 in points).
export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80,
} as const;

export const radius = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, pill: 999,
} as const;

export const fontWeight = {
  light: '300', regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800',
} as const;

// Font family names registered by `fonts.ts`. React Native cannot vary weight
// via `fontWeight` for custom fonts on Android — each weight is its own family.
export const fontFamily = {
  light: 'PlusJakarta-Light',
  regular: 'PlusJakarta-Regular',
  medium: 'PlusJakarta-Medium',
  semibold: 'PlusJakarta-SemiBold',
  bold: 'PlusJakarta-Bold',
  extrabold: 'PlusJakarta-ExtraBold',
  // Mono accents (photo counters) use the platform monospace — not worth
  // bundling JetBrains Mono for a handful of "n/3" labels.
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
} as const;

/** Pick the brand family that matches a numeric weight string. */
export function familyForWeight(weight: string): string {
  switch (weight) {
    case '300': return fontFamily.light;
    case '400': return fontFamily.regular;
    case '500': return fontFamily.medium;
    case '600': return fontFamily.semibold;
    case '700': return fontFamily.bold;
    case '800': return fontFamily.extrabold;
    default: return fontFamily.regular;
  }
}

type TypeToken = { size: number; lineHeight: number; weight: string; tracking?: number };

function typeStyle(t: TypeToken): TextStyle {
  return {
    fontSize: t.size,
    lineHeight: t.lineHeight,
    fontFamily: familyForWeight(t.weight),
    fontWeight: t.weight as TextStyle['fontWeight'],
    letterSpacing: t.tracking,
  };
}

const caregiverTokens: Record<string, TypeToken> = {
  displayLight: { size: 34, lineHeight: 40, weight: '300', tracking: -0.5 },
  displayBold: { size: 34, lineHeight: 40, weight: '800', tracking: -0.5 },
  h1: { size: 28, lineHeight: 34, weight: '700', tracking: -0.3 },
  h2: { size: 22, lineHeight: 28, weight: '700', tracking: -0.2 },
  title: { size: 18, lineHeight: 24, weight: '700' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  bodyMedium: { size: 16, lineHeight: 24, weight: '500' },
  bodySmall: { size: 14, lineHeight: 20, weight: '400' },
  caption: { size: 13, lineHeight: 18, weight: '500' },
};

const dadTokens: Record<string, TypeToken> = {
  actionLabel: { size: 44, lineHeight: 48, weight: '800', tracking: -0.5 },
  spoken: { size: 28, lineHeight: 38, weight: '600' },
  statusLabel: { size: 26, lineHeight: 32, weight: '700' },
  cancelHint: { size: 24, lineHeight: 30, weight: '600' },
};

export const type = {
  caregiver: Object.fromEntries(
    Object.entries(caregiverTokens).map(([k, v]) => [k, typeStyle(v)]),
  ) as Record<keyof typeof caregiverTokens, TextStyle>,
  dad: Object.fromEntries(
    Object.entries(dadTokens).map(([k, v]) => [k, typeStyle(v)]),
  ) as Record<keyof typeof dadTokens, TextStyle>,
};

// Per-platform elevation. iOS uses shadow* props; Android uses elevation.
const SHADOWS = {
  sm: {
    ios: { shadowColor: '#0C0D0F', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
    android: { elevation: 1 },
  },
  md: {
    ios: { shadowColor: '#0C0D0F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 3 },
  },
  lg: {
    ios: { shadowColor: '#0C0D0F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 24 },
    android: { elevation: 6 },
  },
  sheet: {
    ios: { shadowColor: '#0C0D0F', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 28 },
    android: { elevation: 12 },
  },
} as const;

/** Resolve a named shadow to the right prop set for the current platform. */
export function shadow(level: keyof typeof SHADOWS): ViewStyle {
  return (Platform.OS === 'android' ? SHADOWS[level].android : SHADOWS[level].ios) as ViewStyle;
}

export const touchTarget = { caregiverMin: 56, dadMin: 88, iconButton: 48 } as const;

export const motion = {
  duration: { instant: 0, fast: 120, base: 200, slow: 320, deliberate: 500 },
  // Reanimated/Animated bezier control points.
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    decelerate: [0, 0, 0, 1] as const,
    accelerate: [0.3, 0, 1, 1] as const,
  },
} as const;

// Ionicons name map (`@expo/vector-icons`). Mirrors tokens.json → icon.names.
export const iconNames = {
  describe: 'camera-outline',
  ask: 'mic-outline',
  listening: 'radio-outline',
  speaking: 'volume-high-outline',
  cancel: 'close',
  settings: 'settings-outline',
  add: 'add',
  edit: 'create-outline',
  delete: 'trash-outline',
  objects: 'cube-outline',
  rooms: 'home-outline',
  photo: 'camera',
  back: 'chevron-back',
  forward: 'arrow-forward',
  check: 'checkmark',
  retake: 'refresh',
  error: 'alert-circle-outline',
  lastSeen: 'time-outline',
  debug: 'bug-outline',
  star: 'star',
  starOutline: 'star-outline',
  call: 'call-outline',
} as const;

export type IconName = keyof typeof iconNames;
