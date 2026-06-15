export const colors = {
  background: '#0A0A0F',
  surface: '#141419',
  surfaceLight: '#1E1E26',
  surfaceHover: '#252530',
  primary: '#1DB954',
  primaryDark: '#158C40',
  primaryGlow: 'rgba(29, 185, 84, 0.15)',
  primaryMuted: 'rgba(29, 185, 84, 0.3)',
  text: '#FFFFFF',
  textSecondary: '#A7A7B0',
  textTertiary: '#6B6B76',
  accent: '#1ED760',
  error: '#E85D5D',
  warning: '#F5A623',
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayHeavy: 'rgba(0, 0, 0, 0.8)',
  gradientStart: '#1DB954',
  gradientEnd: '#0A7E35',
} as const;

export type ColorKey = keyof typeof colors;
